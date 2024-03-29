/*
About Version Information Strings
The size of a QR code is represented by a number called the version number. Codes that are version 7 and larger must include two 6x3 rectangular blocks that contain the version information string. For details on how these version information strings are calculated and where they should be placed in the QR code, please see the Format and Version Information page.
*/
class VersionInformationTable {
	constructor() {
		this.versions = [
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"000111110010010100",
			"001000010110111100",
			"001001101010011001",
			"001010010011010011",
			"001011101111110110",
			"001100011101100010",
			"001101100001000111",
			"001110011000001101",
			"001111100100101000",
			"010000101101111000",
			"010001010001011101",
			"010010101000010111",
			"010011010100110010",
			"010100100110100110",
			"010101011010000011",
			"010110100011001001",
			"010111011111101100",
			"011000111011000100",
			"011001000111100001",
			"011010111110101011",
			"011011000010001110",
			"011100110000011010",
			"011101001100111111",
			"011110110101110101",
			"011111001001010000",
			"100000100111010101",
			"100001011011110000",
			"100010100010111010",
			"100011011110011111",
			"100100101100001011",
			"100101010000101110",
			"100110101001100100",
			"100111010101000001",
			"101000110001101001"
		]
	}
	getVersionCode(version) {
		return this.versions[version]
	}
}

export default new VersionInformationTable()