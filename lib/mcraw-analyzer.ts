/**
 * MCRAW Binary Structure Analyzer
 * This module analyzes the raw binary structure of MCRAW files
 * to help understand the actual container format
 */

export interface BlockInfo {
  offset: number
  type: number
  size: number
  preview: string // hex preview of first 16 bytes of data
}

export interface McrawAnalysis {
  fileSize: number
  jsonMetadataEnd: number
  blocks: BlockInfo[]
  zstdSignatures: number[]
  possibleFrameOffsets: number[]
  rawHexDump: string // first 512 bytes after JSON as hex
}

export function analyzeMcrawStructure(data: Uint8Array, jsonEndOffset: number): McrawAnalysis {
  const analysis: McrawAnalysis = {
    fileSize: data.length,
    jsonMetadataEnd: jsonEndOffset,
    blocks: [],
    zstdSignatures: [],
    possibleFrameOffsets: [],
    rawHexDump: "",
  }

  // Dump first 512 bytes after JSON metadata as hex
  const dumpStart = jsonEndOffset
  const dumpEnd = Math.min(dumpStart + 512, data.length)
  const hexBytes: string[] = []
  for (let i = dumpStart; i < dumpEnd; i++) {
    hexBytes.push(data[i].toString(16).padStart(2, "0"))
  }
  analysis.rawHexDump = hexBytes.join(" ")

  // Scan for zstd magic bytes (0x28 0xB5 0x2F 0xFD)
  for (let i = jsonEndOffset; i < data.length - 4; i++) {
    if (data[i] === 0x28 && data[i + 1] === 0xb5 && data[i + 2] === 0x2f && data[i + 3] === 0xfd) {
      analysis.zstdSignatures.push(i)
      if (analysis.zstdSignatures.length >= 200) break // limit to first 200
    }
  }

  // Try to parse as type-prefixed blocks
  let offset = jsonEndOffset
  let blockCount = 0
  while (offset < data.length - 8 && blockCount < 500) {
    const view = new DataView(data.buffer, data.byteOffset + offset, 8)
    const blockType = view.getUint32(0, true)
    const blockSize = view.getUint32(4, true)

    // Validate block - type should be small (0-10), size should be reasonable
    if (blockType <= 10 && blockSize > 0 && blockSize < 50 * 1024 * 1024 && offset + 8 + blockSize <= data.length) {
      const dataStart = offset + 8
      const previewBytes: string[] = []
      for (let i = 0; i < Math.min(16, blockSize); i++) {
        previewBytes.push(data[dataStart + i].toString(16).padStart(2, "0"))
      }

      analysis.blocks.push({
        offset,
        type: blockType,
        size: blockSize,
        preview: previewBytes.join(" "),
      })

      // Type 2 might be video frame
      if (blockType === 2) {
        analysis.possibleFrameOffsets.push(offset)
      }

      offset += 8 + blockSize
      blockCount++
    } else {
      // Not a valid block header, try scanning byte by byte for patterns
      break
    }
  }

  // If no blocks found, try alternative: scan for repeating size patterns
  if (analysis.blocks.length === 0) {
    // Look for 4-byte little-endian sizes that repeat
    const sizes = new Map<number, number[]>()
    for (let i = jsonEndOffset; i < Math.min(jsonEndOffset + 10000, data.length - 4); i++) {
      const view = new DataView(data.buffer, data.byteOffset + i, 4)
      const possibleSize = view.getUint32(0, true)
      // Reasonable frame size: 100KB to 10MB
      if (possibleSize >= 100000 && possibleSize <= 10000000) {
        if (!sizes.has(possibleSize)) {
          sizes.set(possibleSize, [])
        }
        sizes.get(possibleSize)!.push(i)
      }
    }

    // Log sizes that appear multiple times (likely frame size markers)
    console.log("[v0] Repeating size patterns found:")
    sizes.forEach((offsets, size) => {
      if (offsets.length >= 2) {
        console.log(
          `[v0]   Size ${size} (${(size / 1024).toFixed(1)}KB) appears at offsets: ${offsets.slice(0, 5).join(", ")}${offsets.length > 5 ? "..." : ""}`,
        )
      }
    })
  }

  return analysis
}

export function logAnalysis(analysis: McrawAnalysis): void {
  console.log("[v0] ===== MCRAW BINARY ANALYSIS =====")
  console.log(`[v0] File size: ${analysis.fileSize} bytes (${(analysis.fileSize / 1024 / 1024).toFixed(2)} MB)`)
  console.log(`[v0] JSON metadata ends at: ${analysis.jsonMetadataEnd}`)
  console.log(`[v0] Zstd signatures found: ${analysis.zstdSignatures.length}`)
  if (analysis.zstdSignatures.length > 0) {
    console.log(`[v0] First 10 zstd offsets: ${analysis.zstdSignatures.slice(0, 10).join(", ")}`)
  }
  console.log(`[v0] Blocks parsed: ${analysis.blocks.length}`)
  if (analysis.blocks.length > 0) {
    console.log("[v0] First 10 blocks:")
    analysis.blocks.slice(0, 10).forEach((b, i) => {
      console.log(`[v0]   [${i}] offset=${b.offset}, type=${b.type}, size=${b.size}, preview=${b.preview}`)
    })
  }
  console.log(`[v0] Possible frame offsets: ${analysis.possibleFrameOffsets.length}`)
  console.log("[v0] Raw hex dump (first 512 bytes after JSON):")
  // Split into 32-byte lines for readability
  const hexLines = analysis.rawHexDump.match(/.{1,96}/g) || []
  hexLines.forEach((line, i) => {
    console.log(`[v0] ${(analysis.jsonMetadataEnd + i * 32).toString(16).padStart(8, "0")}: ${line}`)
  })
  console.log("[v0] ===== END ANALYSIS =====")
}
