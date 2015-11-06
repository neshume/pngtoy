/*
	Parse IDAT

	pngtoy
	By Ken Nilsen / Epistemex (c) 2015
	www.epistemex.com
 */
PngToy._IDAT = function(host) {

	var buffer = host.buffer,
		chunks = host.chunks,
		allowInvalid = host.allowInvalid,
		i = 0, chunk, isEnd,
		inflate = new pako.Inflate(), hasIDAT = false;

	for(; chunk = chunks[i++];) {
		if (chunk.name === "IDAT") {
			hasIDAT = true;
			isEnd = (chunks[i].name === "IEND");
			inflate.push(new Uint8Array(buffer, chunk.offset, chunk.length), isEnd)
		}
	}

	// wo IEND the inflate won't flush - can be redesigned to do a check pass first, then push() pass
	// since data can be decompressed wo IEND provided it's not missing due to corruption
	if (!isEnd && !allowInvalid)
		return {error: "Critical - missing IEND chunk."};

	return hasIDAT ?
		   (inflate.err ? {error: inflate.msg} : {buffer: inflate.result}) :
		   (allowInvalid ? {buffer: null} : {error: "Critical - no IDAT chunk(s)."})
};