/*
	Parse gAMA

	pngtoy
	By Ken Nilsen / Epistemex (c) 2015
	www.epistemex.com
 */
PngToy._gAMA = function(host) {

	var view = host.view,
		chunks = host.chunks,
		allowInvalid = host.allowInvalid,
		chunk = PngToy._findChunk(chunks, "gAMA"),
		gamma;

	if (!chunk) return null;

	gamma = view.getUint32(chunk.offset) / 100000;

	if (!allowInvalid) {
		// todo check some range??
	}

	return {gamma: gamma}
};