export function bin2Dec(bin) {
	return parseInt(bin, 2)
}
export function bin2DecAll(binArr) {
	return binArr.map(bin => bin2Dec(bin))
}
export function dec2Bin(dec, bits = 8) {
	return Number(dec).toString(2).padStart(bits, "0")
}
export function dec2BinAll(decArr, bits = 8) {
	return decArr.map(dec => dec2Bin(dec, bits))
}