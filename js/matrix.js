class Matrix {
	constructor(width, height, data = null) {
		this.width = width
		this.height = height
		if (Array.isArray(data)) {
			this.data = data
		} else {
			this.data = new Array(width * height).fill(data)
		}
	}
	checkPos(pos) {
		if (pos.col < 0 || pos.col >= this.width || pos.row < 0 || pos.row >= this.height) {
			return undefined
		}
		return pos
	}
	pos2Index(col, row) {
		if (!this.checkPos({ col, row })) {
			return undefined
		}
		return row * this.width + col
	}
	index2Pos(index) {
		const col = index % this.width
		const row = Math.floor(index / this.width)
		return this.checkPos({ col, row })
	}
	getValue(col, row) {
		return this.data[this.pos2Index(col, row)]
	}
	setValue(col, row, value, overlap = true) {
		const index = this.pos2Index(col, row)
		if (index !== undefined) {
			if (overlap || this.data[index] === null) {
				this.data[index] = value
				return value
			}
		}
		return false
	}
	clone() {
		return new Matrix(this.width, this.height, this.data.slice())
	}
	forEach(callback) {
		this.data.forEach((value, index) => {
			const pos = this.index2Pos(index)
			callback(value, pos.col, pos.row, index)
		})
	}
	map(callback) {
		this.forEach((value, col, row, index) => {
			this.data[index] = callback(value, col, row, index)
		})
	}
	applyMatrix(colOffset, rowOffset, matrix) {
		matrix.forEach((value, col, row) => {
			this.setValue(col + colOffset, row + rowOffset, value)
		})
	}
	matchMatrix(colOffset, rowOffset, matrix) {
		for (let i = 0; i < matrix.data.length; i++) {
			const pos = matrix.index2Pos(i)
			if (this.getValue(pos.col + colOffset, pos.row + rowOffset) !== matrix.data[i]) {
				return false
			}
		}
		return true
	}
}

export default Matrix