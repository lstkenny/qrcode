/*
	Error Correction Level	Bits	Integer Equivalent
	L						01		1
	M						00		0
	Q						11		3
	H						10		2
*/
class ErrorCorrectionLevelTable {
	constructor() {
		levels: {
			"M": "00", 
			"L": "01", 
			"H": "10", 
			"Q": "11"
		}
	}
	getLevelCode(level) {
		return this.levels[level]
	}
}

export default new ErrorCorrectionLevelTable()