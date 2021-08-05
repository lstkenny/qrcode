import { dec2Bin } from "./binary.js"
/*
	Mode indicator table
	Mode Name	Mode Indicator
	Numeric Mode	0001
	Alphanumeric Mode	0010
	Byte Mode	0100
	Kanji Mode	1000
	ECI Mode	0111
*/
class ModesTable {
	constructor() {
		this.modes = ["numeric", "alphanumeric", "byte", "kanji"]
		this.modeIndicators = ["0001", "0010", "0100", "1000", "0111"]
		this.characterCountBits = [
			[10, 9, 8],	//	Versions 1 - 9
			[12, 11, 16], //	Versions 10 - 26
			[14, 13, 16]	//	Versions 27 - 40
		]
	}
	getModeIndex(mode) {
		return this.modes.indexOf(mode.toLowerCase())
	}
	getModeIndicator(mode) {
		return this.modeIndicators[this.getModeIndex(mode)] || null
	}
	getCharacterCountIndicator(length, version, mode) {
		let countIndex
		if (version < 10) {
			countIndex = 0
		} else if (version < 27) {
			countIndex = 1
		} else  {
			countIndex = 2
		}
		const bits = this.characterCountBits[countIndex][this.getModeIndex(mode)]
		return dec2Bin(length, bits)
	}
	detectMode(string) {
		if (/^\d+$/.test(string)) {
			//	numeric
			return this.modes[0]
		} else if (/^[0-9A-Z$%*+-./: ]+$/.test(string)) {
			//	alphanumeric
			return this.modes[1]
		} else {
			//	byte
			return this.modes[2]
		}
	}
}

export default new ModesTable()