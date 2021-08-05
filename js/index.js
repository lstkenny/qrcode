import { bin2DecAll, dec2BinAll } from "./binary.js"
import encodeText from "./encodeText.js"
import characterCapacitiesTable from "./characterCapacitiesTable.js"
import modesTable from "./modesTable.js"
import errorCorrectionTable from "./errorCorrectionTable.js"
import polynomialTable from "./polynomialTable.js"
import codeVersionTable from "./codeVersionTable.js"
import formatInformationTable from "./formatInformationTable.js"
import versionInformationTable from "./versionInformationTable.js"
import Matrix from "./matrix.js"

function encodeMessage(message, ecLevel) {
	//	encode message and detect message mode
	const { mode, encodedText } = encodeText(message)
	//	Determine the Smallest Version for the Data
	const version = characterCapacitiesTable.getVersion(message.length, ecLevel, mode)
	//	Add the Mode Indicator
	const modeIndicator = modesTable.getModeIndicator(mode)
	//	Add the Character Count Indicator
	const lengthIndicator = modesTable.getCharacterCountIndicator(message.length, version, mode)
	//	Add mode indicator and length indicator bytes at the beginning of encoded message
	let encoded = modeIndicator + lengthIndicator + encodedText
	//	Determine the Required Number of Bits for this QR Code
	const codewordsOptions = errorCorrectionTable.getData(version, ecLevel)
	const codewordsBits = codewordsOptions.tc * 8
	//	Add a Terminator of 0s if Necessary
	const terminatorBits = Math.min(codewordsBits - encoded.length, 4)
	//	Add More 0s to Make the Length a Multiple of 8
	let octetBits = 0
	const octetTail = (encoded.length + terminatorBits) % 8
	if (octetTail) {
		octetBits = 8 - octetTail
	}
	// console.log({ codewordsBits, terminatorBits, octetBits, messageBits: encoded.length })
	encoded += "0".repeat(terminatorBits + octetBits)
	//	Add Pad Bytes if the String is Still too Short
	const additionalBytes = ["11101100", "00010001"]
	let index = 0
	while (encoded.length < codewordsBits) {
		encoded += additionalBytes[index]
		index = index ? 0 : 1
	}
	//	Break Up into 8-bit Codewords
	const codewords = bin2DecAll(encoded.match(/.{1,8}/g))
	return { mode, version, modeIndicator, lengthIndicator, encoded, codewords, codewordsOptions }
}

function groupCodewords(codewords, codewordsOptions) {
	codewords = codewords.slice()
	const codewordsGroup = []
	//	Get total group count from options
	const totalGroups = codewordsOptions.cb2 ? 2 : 1
	for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
		codewordsGroup[groupIndex] = []
		const groupNumber = groupIndex + 1
		//	Get total blocks count from options
		const totalBlocks = codewordsOptions[`b${groupNumber}`]
		//	Get codewords count per block from options
		const totalCodewords = codewordsOptions[`cb${groupNumber}`]
		for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex++) {
			codewordsGroup[groupIndex].push(codewords.splice(0, totalCodewords))
		}
	}
	return codewordsGroup
}

function getCorrectionCodewordsGroup(codewordsGroup, codewordsOptions) {
	const gp = polynomialTable.generatorPolynomial(codewordsOptions.ecb)
	const correctionGroup = []
	codewordsGroup.forEach((group, groupIndex) => {
		correctionGroup[groupIndex] = []
		group.forEach((block, blockIndex) => {
			correctionGroup[groupIndex][blockIndex] = polynomialTable.div(block, gp)
		})
	})
	return correctionGroup
}

function interleave(groups) {
	let result = []
	//	Get total blocks count in all groups
	let allBlocksCount = 0
	groups.forEach(group => allBlocksCount += group.length)
	let allBlocksIndex = 0
	groups.forEach((group, groupIndex) => {
		group.forEach((block, blockIndex) => {
			block.forEach((codeword, codewordIndex) => {
				//	Index of a codeword in the one-dimensional interleaved array
				const index = codewordIndex * allBlocksCount + allBlocksIndex
				result[index] = codeword
			})
			//	Next block index
			allBlocksIndex++
		})
	})
	return result.filter(codeword => codeword)
}

function createCodeBlock(codewordsInterleaved, correctionInterleaved, reminderBits) {
	//	Сoncat codewords to final code
	let codeBlock = codewordsInterleaved.concat(correctionInterleaved)
	//	Convert to 8bit binary
	codeBlock = dec2BinAll(codeBlock)
	codeBlock = codeBlock.join("")
	//	Add reminder bits for specific version
	if (reminderBits) {
		codeBlock += "0".repeat(reminderBits)
	}
	return codeBlock
}

function applyFinderPatterns(matrix) {
	const finder = new Matrix(9, 9, [
		0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 1, 1, 1, 1, 1, 1, 1, 0,
		0, 1, 0, 0, 0, 0, 0, 1, 0,
		0, 1, 0, 1, 1, 1, 0, 1, 0,
		0, 1, 0, 1, 1, 1, 0, 1, 0,
		0, 1, 0, 1, 1, 1, 0, 1, 0,
		0, 1, 0, 0, 0, 0, 0, 1, 0,
		0, 1, 1, 1, 1, 1, 1, 1, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0,
	])
	//	Apply finder patterns to matrix corners
	matrix.applyMatrix(-1, -1, finder)
	matrix.applyMatrix(-1, matrix.width - finder.width + 1, finder)
	matrix.applyMatrix(matrix.height - finder.height + 1, -1, finder)
}

function applyAlignmentPatterns(matrix, version) {
	const alignment = new Matrix(5, 5, [
		1, 1, 1, 1, 1,
		1, 0, 0, 0, 1,
		1, 0, 1, 0, 1,
		1, 0, 0, 0, 1,
		1, 1, 1, 1, 1,
	])
	//	The locations at which the alignment patterns must be placed are defined in the alignment pattern locations table.
	const alignmentPositions = codeVersionTable.getAlignmentPos(version)
	alignmentPositions.forEach(col => {
		alignmentPositions.forEach(row => {
			//	Alignment patterns MUST NOT overlap the finder patterns or separators.
			if (matrix.getValue(col, row) === null) {
				matrix.applyMatrix(col - 2, row - 2, alignment, 2)
			}
		})
	})
}

function applyTimingPatterns(matrix) {
	for (let i = 6; i < matrix.width - 6; i++) {
		matrix.setValue(i, 6, (i + 1) % 2, false)
		matrix.setValue(6, i, (i + 1) % 2, false)
	}
}

function reserveFormatInfoArea(matrix) {
	for (let i = 0; i < 9; i++) {
		matrix.setValue(8, i, 0, false)
		matrix.setValue(i, 8, 0, false)
		matrix.setValue(matrix.width - i, 8, 0, false)
		matrix.setValue(8, matrix.height - i, 0, false)
	}
}

function applyFormatInformation(matrix, formatCode) {
	if (formatCode) {
		for (let i = 0; i < 15; i++) {
			if (i < 7) {
				matrix.setValue(8, matrix.height - 1 - i, Number(formatCode[i]), true)
			} else if (i < 9) {
				matrix.setValue(8, 15 - i, Number(formatCode[i]), true)
			} else {
				matrix.setValue(8, 14 - i, Number(formatCode[i]), true)
			}
			if (i < 6) {
				matrix.setValue(i, 8, Number(formatCode[i]), true)
			} else if (i < 7) {
				matrix.setValue(i + 1, 8, Number(formatCode[i]), true)
			} else {
				matrix.setValue(matrix.width - 15 + i, 8, Number(formatCode[i]), true)
			}
		}
	}
}

function reserveVersionInfoArea(matrix, version) {
	if (version > 6) {
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 6; j++) {
				matrix.setValue(matrix.width - 9 - i, j, 0)
				matrix.setValue(j, matrix.height - 9 - i, 0)
			}
		}
	}
}

function applyVersionInformation(matrix, versionCode) {
	if (versionCode) {
		const versionMatrix = new Matrix(3, 6, versionCode.split("").reverse())
		versionMatrix.forEach((value, col, row) => {
			matrix.setValue(col + matrix.width - 11, row, Number(value))
			matrix.setValue(row, col + matrix.height - 11, Number(value))
		})
	}
}

function applyCodeBlockData(matrix, codeBlock) {
	let msgIndex = 0
	const cols2 = (matrix.width - 1) / 2
	for (let col2 = cols2; col2 >= 0; col2--) {
		//	 When the vertical timing pattern is reached, always start the next column to the left of it. No column should ever overlap the vertical timing pattern.
		let col = (col2 > 3) ? col2 * 2 : col2 * 2 - 1
		for (let row2 = 0; row2 < matrix.height; row2++) {
			//	The data bits are placed starting at the bottom-right of the matrix and proceeding upward in a column that is 2 modules wide. When the column reaches the top, the next 2-module column starts immediately to the left of the previous column and continues downward.
			let row = (col2 % 2) ? row2 : matrix.height - row2 - 1
			//	When a function pattern is encountered, skip any occupied modules until you reach the next unused module.
			for (let i = 0; i < 2; i++) {
				if (matrix.setValue(col - i, row, Number(codeBlock[msgIndex]), false) !== false) {
					msgIndex++
				}
			}
		}
	}
	if (msgIndex !== codeBlock.length) {
		throw new Error(`Final message bits length mismatch: ${msgIndex} from ${codeBlock.length}`)
	}
}

function createMatrix({ version, codeBlock }) {
	const matrixSize = codeVersionTable.getSize(version)
	const matrix = new Matrix(matrixSize, matrixSize)
	//	Add the Finder Patterns
	applyFinderPatterns(matrix)
	//	Add the Alignment Patterns and mask
	applyAlignmentPatterns(matrix, version)
	//	Add the Timing Patterns
	applyTimingPatterns(matrix)
	//	Add the Dark Module beside the bottom left finder pattern
	matrix.setValue(8, 4 * version + 9, 1)
	//	Add Reserved Areas beside the finder separators 
	reserveFormatInfoArea(matrix)
	//	Reserve the Version Information Area for QR codes with versions 7 and larger
	reserveVersionInfoArea(matrix, version)
	//	Place the Data Bits
	applyCodeBlockData(matrix, codeBlock)
	return matrix
}

function isFunctionalModule(matrix, col, row) {
	//	finder module
	if ((col < 8 && row < 8) || (col < 8 && row >= matrix.height - 8) || (col >= matrix.width - 8 && row >= matrix.height - 8)) {
		return true
	}
	//	timing
	if (col === 6 || row === 6) {
		return true
	}
	//	 dark module
	if (col === 9 && row === matrix.height - 8) {
		return true
	}
	//	alignment !!!TODO
	// 1 - 21
	// 2 - 25
	// 3 - 29
	// 4 - 31
	// 5 - 37
	// const alignmentPositions = codeVersionTable.getAlignmentPos(version)
	return false
}

function mask(matrix, pattern) {
	// Mask Number	If the formula below is true for a given row/column coordinate, switch the bit at that coordinate
	// 0	(row + column) mod 2 == 0
	// 1	(row) mod 2 == 0
	// 2	(column) mod 3 == 0
	// 3	(row + column) mod 3 == 0
	// 4	( floor(row / 2) + floor(column / 3) ) mod 2 == 0
	// 5	((row * column) mod 2) + ((row * column) mod 3) == 0
	// 6	( ((row * column) mod 2) + ((row * column) mod 3) ) mod 2 == 0
	// 7	( ((row + column) mod 2) + ((row * column) mod 3) ) mod 2 == 0
	matrix.clone().map((value, col, row) => {
		if (isFunctionalModule(matrix, col, row)) {
			//	do not change functional modules
			return value
		}
		let invert = false
		switch (pattern) {
			case 0:
				invert = ((row + col) % 2 === 0)
				break
			case 1:
				invert = ((row) % 2 === 0)
				break
			case 2:
				invert = ((col) % 3 === 0)
				break
			case 3:
				invert = ((row + col) % 3 === 0)
				break
			case 4:
				invert = (( Math.floor(row / 2) + Math.floor(col / 3) ) % 2 === 0)
				break
			case 5:
				invert = (((row * col) % 2) + ((row * col) % 3) === 0)
				break
			case 6:
				invert = (( ((row * col) % 2) + ((row * col) % 3) ) % 2 === 0)
				break
			case 7:
				invert = (( ((row + col) % 2) + ((row * col) % 3) ) % 2 === 0)
				break
		}
		if (invert) {
			value ^= 1
		}
		return value
	})
	return matrix
}

function getPenalty(matrix) {
	let penalty = 0
	//	The first rule gives the QR code a penalty for each group of five or more same-colored modules in a row (or column).
	for (let i = 0; i < matrix.width; i++) {
		let cols = 0
		let rows = 0
		let colPrev, rowPrev
		for (let j = 0; j < matrix.height; j++) {
			let colValue = matrix.getValue(i, j)	//	cols
			let rowValue = matrix.getValue(j, i)	//	rows
			if (colPrev !== colValue) {
				cols = 0
			}
			if (rowPrev !== rowValue) {
				rows = 0
			}
			colPrev = colValue
			rowPrev = rowValue
			cols++
			rows++
			if (cols === 5) {
				penalty += 3
			} else if (cols > 5) {
				penalty += 1
			}
			if (rows === 5) {
				penalty += 3
			} else if (rows > 5) {
				penalty += 1
			}
		}
	}
	//	The second rule gives the QR code a penalty for each 2x2 area of same-colored modules in the matrix.
	const squares = [
		new Matrix(2, 2, [0, 0, 0, 0]),
		new Matrix(2, 2, [1, 1, 1, 1])
	]
	matrix.forEach((value, col, row) => {
		squares.forEach(square => {
			if (matrix.matchMatrix(col, row, square)) {
				penalty += 3
			}
		})
	})
	//	The third rule gives the QR code a large penalty if there are patterns that look similar to the finder patterns.
	const finders = [
		new Matrix(1, 11, [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]),
		new Matrix(1, 11, [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]),
		new Matrix(11, 1, [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]),
		new Matrix(11, 1, [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]),
	]
	matrix.forEach((value, col, row) => {
		finders.forEach(finder => {
			if (matrix.matchMatrix(col, row, finder)) {
				penalty += 40
			}
		})
	})
	//	The fourth rule gives the QR code a penalty if more than half of the modules are dark or light, with a larger penalty for a larger difference.
	//	The final evaluation condition is based on the ratio of light modules to dark modules. To calculate this penalty rule, do the following steps:
	//	1. Count the total number of modules in the matrix.
	//	2. Count how many dark modules there are in the matrix.
	const modules = [0, 0]
	matrix.forEach(value => {
		modules[value]++
	})
	//	3. Calculate the percent of modules in the matrix that are dark: (darkmodules / totalmodules) * 100
	const darkModulesPercent = modules[1] / (modules[0] + modules[1]) * 100
	//	4. Determine the previous and next multiple of five of this percent. For example, for 43 percent, the previous multiple of five is 40, and the next multiple of five is 45.
	const dmpt = darkModulesPercent * 0.2
	const darkModulesPercentPrev = Math.floor(dmpt) / 0.2
	const darkModulesPercentNext = Math.ceil(dmpt) / 0.2
	//	5. Subtract 50 from each of these multiples of five and take the absolute value of the result. For example, |40 - 50| = |-10| = 10 and |45 - 50| = |-5| = 5.
	//	6. Divide each of these by five. For example, 10/5 = 2 and 5/5 = 1.
	const darkModulesAbsPrevDiff = Math.abs(darkModulesPercentPrev - 50) / 5
	const darkModulesAbsNextDiff = Math.abs(darkModulesPercentNext - 50) / 5
	//	7. Finally, take the smallest of the two numbers and multiply it by 10. In this example, the lower number is 1, so the result is 10. This is penalty score #4.
	penalty += Math.min(darkModulesAbsPrevDiff, darkModulesAbsNextDiff) * 10
	return penalty
}

function applyMask(matrix, maskPattern) {
	//	Determining the Best Mask
	if (maskPattern === "auto") {
		let bestPenalty = Infinity
		for (let i = 0; i < 8; i++) {
			let clone = matrix.clone()
			applyFormatInformation(clone, formatInformationTable.getFormatCode(ecLevel, i))
			clone = mask(clone, i)
			const penalty = getPenalty(clone)
			console.log(i, penalty)
			if (penalty < bestPenalty) {
				bestPenalty = penalty
				maskPattern = i
				matrix = clone
			}
		}
	} else if (maskPattern !== "none") {
		matrix = mask(matrix, Number(maskPattern))
	}
	return { matrix, maskPattern }
}

function generate(message, options) {
	//	Encode string to message codewords, detect mode and version
	const ecLevel = options.ecLevel || "M"
	const { mode, version, codewords, codewordsOptions } = encodeMessage(message, ecLevel)
	//	Split message codewords to groups and blocks according to error correction table
	const codewordsGroup = groupCodewords(codewords, codewordsOptions)
	//	Generating Error Correction Codewords
	const correctionGroup = getCorrectionCodewordsGroup(codewordsGroup, codewordsOptions)
	//	Interleave the Blocks
	const codewordsInterleaved = interleave(codewordsGroup)
	const correctionInterleaved = interleave(correctionGroup)
	//	Get final code bits
	const codeBlock = createCodeBlock(codewordsInterleaved, correctionInterleaved, codeVersionTable.getReminderBits(version))
	//	Place modules to the matrix
	const rawMatrix = createMatrix({ version, codeBlock })
	//	Apply version information
	applyVersionInformation(rawMatrix, versionInformationTable.getVersionCode(version))
	//	Apply mask
	const { matrix, maskPattern } = applyMask(rawMatrix, options.maskPattern || "auto", ecLevel)
	console.log({ ecLevel, mode, version, codewords, codewordsOptions, codewordsGroup, correctionGroup, codeBlock, maskPattern, matrix })
	return matrix
}

function setCanvas(size) {
	const cnv = document.createElement("canvas")
	cnv.width = size
	cnv.height = size
	const ctx = cnv.getContext("2d")
	document.getElementById("qr").appendChild(cnv)
	return { cnv, ctx }
}
function drawModule(col, row, value, size) {
	ctx.fillStyle = colors[value] || colors[2]
	ctx.fillRect(col * size, row * size, size, size)
}
function drawMatrix(matrix) {
	ctx.fillStyle = colors[2]
	ctx.fillRect(0, 0, cnv.width, cnv.height)
	const size = cnv.width / matrix.width
	matrix.forEach((value, col, row) => {
		drawModule(col, row, value, size)
	})
}

function showQRCode() {
	const text = document.getElementById("text").value
	if (!text) {
		return
	}
	const ecLevel = document.getElementById("ecLevel").value
	const mask = document.getElementById("mask").value
	drawMatrix(generate(text, { ecLevel, mask }))
}

const { cnv, ctx } = setCanvas(200)
const colors = ["#fff", "#000", "#646464", "red", "green", "blue", "magenta", "cyan", "orange", "purple"]

document.getElementById("text").addEventListener("input", showQRCode)
document.getElementById("ecLevel").addEventListener("input", showQRCode)
document.getElementById("mask").addEventListener("input", showQRCode)
document.querySelectorAll('a[data-type="preset"]').forEach(preset => {
	preset.addEventListener("click", e => {
		document.getElementById("text").value = e.target.dataset.text || ""
		document.getElementById("ecLevel").value = e.target.dataset.eclevel || "M"
		document.getElementById("mask").value = e.target.dataset.mask || "auto"
		showQRCode()
	})
})

showQRCode()