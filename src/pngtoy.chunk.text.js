/*
	Parse tEXt

	pngtoy
	By Ken Nilsen / Epistemex (c) 2015
	www.epistemex.com
 */
PngToy._tEXt = function(host) {

	var view = host.view,
		chunks = host.chunks,
		allowInvalid = host.allowInvalid,
		chunkLst = PngToy._findChunks(chunks, "tEXt"),
		warn = false,
		pos, txtBuff, o, i,
		lst = [];

	if (!chunkLst.length) return null;

	chunkLst.forEach(function(chunk) {

		var result = {};
		pos = chunk.offset;

		// keyword
		o = PngToy._getStr(view, pos, 80);
		result.keyword = o.text;
		pos = o.offset;
		if (o.warn) warn = true;

		// convert byte-buffer to string
		txtBuff = new Uint8Array(view.buffer, pos, chunk.length - (pos - chunk.offset));
		o = "";

		for(i = 0; i < txtBuff.length; i++) o += String.fromCharCode(txtBuff[i]);

		result.text = o;

		lst.push(result);

		if (!allowInvalid && warn) {
			return {error: "One or more field contains illegal chars."}
		}
	});

	return lst;
};