import { dec2Bin } from "./binary"
import modesTable from "./modesTable"

function encodeNumeric(str) {
	//	Break up into groups of 3
	const groups = str.match(/.{1,3}/g)
	const result = []
	groups.forEach(group => {
		//	Convert that three-digit number into 10 binary bits. If a group starts with a zero, it should be interpreted as a two-digit number and you should convert it to 7 binary bits, and if there are two zeroes at the beginning of a group, it should be interpreted as a one-digit number and you should convert it to 4 binary bits. Similarly, if the final group consists of only two digits, you should convert it to 7 binary bits, and if the final group consists of only one digit, you should convert it to 4 binary bits.
		group = Number(group).toString()
		const bits = [0, 4, 7, 10]
		result.push(dec2Bin(group, bits[group.length]))
	})
	return result.join("")
}

function encodeAlphanumeric(str) {
	const codesTable = { "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "A": 10, "B": 11, "C": 12, "D": 13, "E": 14, "F": 15, "G": 16, "H": 17, "I": 18, "J": 19, "K": 20, "L": 21, "M": 22, "N": 23, "O": 24, "P": 25, "Q": 26, "R": 27, "S": 28, "T": 29, "U": 30, "V": 31, "W": 32, "X": 33, "Y": 34, "Z": 35, " ": 36, "$": 37, "%": 38, "*": 39, "+": 40, "-": 41, ".": 42, "/": 43, ":": 44 }
	//	Break up into pairs
	const pairs = str.match(/.{1,2}/g)
	const result = []
	pairs.forEach(pair => {
		let encoded
		if (pair.length > 1) {
			//	For each pair of characters, get the number representation (from the alphanumeric table) of the first character and multiply it by 45. Then add that number to the number representation of the second character. Now convert that number into an 11-bit binary string, padding on the left with 0s if necessary.
			encoded = dec2Bin(codesTable[pair[0]] * 45 + codesTable[pair[1]], 11)
		} else {
			//	If you are encoding an odd number of characters, as we are here, take the numeric representation of the final character and convert it into a 6-bit binary string.
			encoded = dec2Bin(codesTable[pair[0]], 6)
		}
		result.push(encoded)
	})
	return result.join("")
}

function encodeBytes(string) {
	const result = []
	for (let i = 0; i < string.length; i++) {
		result.push(dec2Bin(string.charCodeAt(i)))
	}
	return result.join("")
}

export default function encodeText(message) {
	//	Choose the Most Efficient Mode
	const mode = modesTable.detectMode(message)
	let encoded
	//	Encode Using the Selected Mode
	switch (mode) {
		case "numeric":
			encoded = encodeNumeric(message)
			break
		case "alphanumeric":
			encoded = encodeAlphanumeric(message)
			break
		case "byte":
			encoded = encodeBytes(message)
			break
	}
	return { mode, encoded }
}