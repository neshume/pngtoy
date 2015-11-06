/*
	Parse and check chunks

	pngtoy
	By Ken Nilsen / Epistemex (c) 2015
	www.epistemex.com
 */

/**
 * Get and validate chunks
 * @param buffer
 * @param view
 * @param doCRC
 * @param allowInvalid
 * @static
 */
PngToy._getChunks = function(buffer, view, doCRC, allowInvalid) {

	var me = this,
		pos = 8,
		len = buffer.byteLength,
		chunks = [], chunk,
		length, fourCC, offset, crc, colorType,
		plteChunk, trnsChunk, histChunk, offsChunk, sterChunk,
		isIDAT = true,
		noConst = ["iTXT", "tIME", "tEXt","zTXt"],
		fc = PngToy._findChunk;

	// build CRC table if none is built
	if (doCRC && !this.table) {
		this.table = new Uint32Array(256);
		for (var i = 0, j; i < 256; i++) {
			crc = i>>>0;
			for (j = 0; j < 8; j++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
			this.table[i] = crc;
		}
	}

	/*
	Get chunk list with minimal validation
	 */

	while(pos < len) {

		// chunk header
		length = getUint32();
		fourCC = getFourCC();

		if (length > 2147483647 && !allowInvalid) return {error: "Invalid chunk size."};	// max size: 2^31-1

		offset = pos;			// data offset
		pos = offset + length;
		crc = getUint32();		// crc

		chunk = new PngToy.Chunk(fourCC, offset, length, crc);

		if (doCRC) {
			checkCRC(chunk);
			if (!chunk.crcOk && !allowInvalid) return {error: "Invalid CRC in chunk " + fourCC};
		}

		if (chunk.isReserved && !allowInvalid) return {error: "Invalid chunk name: " + fourCC};

		chunks.push(chunk);
	}

	/*
	Do error checking and validation
	 */

	if (!allowInvalid) {

		// check presence and count
		if (!chunksInRange("IHDR", 1, 1)) return {error: "Invalid number of IHDR chunks."};
		if (!chunksInRange("tIME", 0, 1)) return {error: "Invalid number of tIME chunks."};
		if (!chunksInRange("zTXt", 0, -1)) return {error: "Invalid number of zTXt chunks."};
		if (!chunksInRange("tEXt", 0, -1)) return {error: "Invalid number of tEXt chunks."};
		if (!chunksInRange("iTXt", 0, -1)) return {error: "Invalid number of iTXt chunks."};
		if (!chunksInRange("pHYs", 0, 1)) return {error: "Invalid number of pHYs chunks."};
		if (!chunksInRange("sPLT", 0, -1)) return {error: "Invalid number of sPLT chunks."};
		if (!chunksInRange("iCCP", 0, 1)) return {error: "Invalid number of iCCP chunks."};
		if (!chunksInRange("sRGB", 0, 1)) return {error: "Invalid number of sRGB chunks."};
		if (!chunksInRange("sBIT", 0, 1)) return {error: "Invalid number of sBIT chunks."};
		if (!chunksInRange("gAMA", 0, 1)) return {error: "Invalid number of gAMA chunks."};
		if (!chunksInRange("cHRM", 0, 1)) return {error: "Invalid number of cHRM chunks."};
		if (!chunksInRange("PLTE", 0, 1)) return {error: "Invalid number of PLTE chunks."};
		if (!chunksInRange("tRNS", 0, 1)) return {error: "Invalid number of tRNS chunks."};
		if (!chunksInRange("hIST", 0, 1)) return {error: "Invalid number of hIST chunks."};
		if (!chunksInRange("bKGD", 0, 1)) return {error: "Invalid number of bKGD chunks."};
		if (!chunksInRange("IDAT", 1, -1)) return {error: "Invalid number of IDAT chunks."};
		if (!chunksInRange("IEND", 1, 1)) return {error: "Invalid number of IEND chunks."};

		// check critical order
		if (chunks[0].name !== "IHDR" || chunks[chunks.length - 1].name !== "IEND")
			return {error: "Invalid PNG chunk order."};

		// check special cases
		colorType = view.getUint8(fc(chunks, "IHDR").offset + 9);
		plteChunk = fc(chunks, "PLTE");
		histChunk = fc(chunks, "hIST");
		trnsChunk = fc(chunks, "tRNS");
		offsChunk = fc(chunks, "oFFs");
		sterChunk = fc(chunks, "sTER");

		// sRGB and iCCP
		if (fc(chunks, "iCCP") && fc(chunks, "sRGB"))
			return {error: "Both iCCP and sRGB cannot be present."};

		// color type and palette
		if (colorType === 3 && !plteChunk)
			return {error: "Missing PLTE chunk."};

		if ((colorType === 0 || colorType === 4) && plteChunk)
			return {error: "PLTE chunk should not appear with this color type."};

		if ((colorType === 4 || colorType === 6) && trnsChunk)
			return {error: "tRNS chunk should not appear with this color type."};

		// histogram
		if (histChunk && !plteChunk)
			return {error: "hIST chunk can only appear if a PLTE chunk is present."};

		// check order relative to the PLTE chunk
		if (plteChunk) {
			if (!isBefore("PLTE", "IDAT")) return {error: "Invalid chunk order for PLTE."};
			if (histChunk && !isBetween("PLTE", "hIST", "IDAT")) return {error: "Invalid chunk order for hIST."};
			if (trnsChunk && !isBetween("PLTE", "tRNS", "IDAT")) return {error: "Invalid chunk order for tRNS."};
			if (fc(chunks, "bKGD") && !isBetween("PLTE", "bKGD", "IDAT")) return {error: "Invalid chunk order for bKGD."};
			if (!isBefore("cHRM", "PLTE")) return {error: "Invalid chunk order for cHRM."};
			if (!isBefore("gAMA", "PLTE")) return {error: "Invalid chunk order for gAMA."};
			if (!isBefore("iCCP", "PLTE")) return {error: "Invalid chunk order for iCCP."};
			if (!isBefore("sRGB", "PLTE")) return {error: "Invalid chunk order for sRGB."};
		}

		// oFFs chunk
		if (offsChunk && !isBefore("oFFs", "IDAT")) return {error: "Invalid chunk order for oFFs."};

		// sTER chunk
		if (sterChunk && !isBefore("sTER", "IDAT")) return {error: "Invalid chunk order for sTER."};

		// check order of chunks in more detail
		for(i = chunks.length - 2; i > 0; i--) {
			if (isIDAT && chunks[i].name !== "IDAT" && noConst.indexOf(chunks[i].name) < 0) {
				isIDAT = false
			}
			else if (!isIDAT && chunks[i].name === "IDAT") {
				return {error: "Invalid chunk inside IDAT chunk sequence."};
			}
		}
	}

	return {
		chunks: chunks
	};

	function chunksInRange(chunk, min, max) {
		var lst = PngToy._findChunks(chunks, chunk);
		return max < 0 ? lst.length >= min : lst.length >= min && lst.length <= max;
	}

	function isBetween(beforeChunk, chunk, afterChunk) {
		return isBefore(beforeChunk, chunk) && isBefore(chunk, afterChunk)
	}

	function isBefore(beforeChunk, chunk) {

		var bi = -1, ci = -1, i, l = chunks.length;

		for(i = 0; i < l; i++) {
			if (chunks[i].name === beforeChunk) bi = i;
			if (chunks[i].name === chunk) ci = i;
		}

		return (bi < ci);
	}

	function checkCRC(chunk) {

		var crcBuffer = new Uint8Array(buffer, chunk.offset - 4, chunk.length + 4);
		chunk.crcOk = (chunk.crc === calcCRC(crcBuffer));

		function calcCRC(buffer) {
			var crc = (-1>>>0), len = buffer.length, i;
			for (i = 0; i < len; i++) crc = (crc >>> 8) ^ me.table[(crc ^ buffer[i]) & 0xff];
			return (crc ^ -1)>>>0;
		}
	}

	function getFourCC() {
		var v = getUint32(),
			c = String.fromCharCode;
		return	c((v & 0xff000000)>>>24) + c((v & 0xff0000)>>>16) + c((v & 0xff00)>>>8) + c((v & 0xff)>>>0);
	}

	function getUint32() {
		var i = view.getUint32(pos);
		pos += 4;
		return i>>>0;
	}

};

PngToy._getChunks.table = null;

PngToy._findChunk = function(chunks, name) {
	for(var i = 0, chunk; chunk = chunks[i++];) {
		if (chunk.name === name) return chunk;
	}
	return null
};

PngToy._findChunks = function(chunks, name) {
	for(var i = 0, lst = [], chunk; chunk = chunks[i++];) {
		if (chunk.name === name) lst.push(chunk);
	}
	return lst;
};

PngToy._getStr = function(view, offset, max) {

	/*
	All registered textual keywords in text chunks and all other chunk types are limited
	to the ASCII characters A-Z, a-z, 0-9, space, and the following 20 symbols:

	   	! " % & ' ( ) * + , - . / : ; < = > ? _

	but not the remaining 12 symbols:

   		# $ @ [ \ ] ^ ` { | } ~

	This restricted set is the ISO-646 "invariant" character set [ISO-646]. These characters
	have the same numeric codes in all ISO character sets, including all national variants of ASCII.
	 */

	var text = "", i = offset, ch = -1, v,
		warn = false,
		getChar = String.fromCharCode,
		san = " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!\"%&'()*+,-./:;<=>?_";

	max += i;

	for(; i < max && ch;) {
		ch = view.getUint8(i++);
		if (ch) {
			v = getChar(ch);
			if (san.indexOf(v) > -1)
				text += v;
			else
				warn = true;

			continue;
		}
		break;
	}

	return {
		offset: i,
		text: text,
		warning: warn
	}
};

PngToy.Chunk = function(name, offset, length, crc) {

	this.name = name;
	this.offset = offset;
	this.length = length;
	this.crc = crc;
	this.crcOk = true;

	this.isCritical = !(name.charCodeAt(0) & 0x20);
	this.isPrivate = !!(name.charCodeAt(1) & 0x20);
	this.isReserved = !!(name.charCodeAt(2) & 0x20);
	this.isCopySafe = !!(name.charCodeAt(3) & 0x20);
};
