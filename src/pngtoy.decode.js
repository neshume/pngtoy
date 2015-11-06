/*
	Decoder module

	pngtoy
	By Ken Nilsen / Epistemex (c) 2015
	www.epistemex.com
 */
/**
 * Decodes the filtered bitmap from the PNG to a raw bitmap of same
 * byte width and depth. Passes a bitmap object as argument to the promise
 * when done. The decoding is asynchronous and does not block the UI.
 *
 * Call this method after fetch() has been used. The resolve function will
 * receive a bitmap as argument, if rejected a string containing the error
 * will be passed. The bitmap contains the filtered bitmap as well as some
 * key information (additional information is extracted from the chunks).
 *
 * @returns {Promise}
 */
PngToy.prototype.decode = function() {

	var me = this;

	return new Promise(function(resolve, reject) {

		var ihdr = me.get_IHDR(),
			w = ihdr.width,
			h = ihdr.height,
			type = ihdr.type,
			depth = ihdr.depth,
			byteWidth = depth / 8,
			is16 = byteWidth === 2,
			pixelWidth = [1,0,3,1,2,0,4][type],
			mask = is16 ? 0xffff : 0xff,

			delta = pixelWidth * byteWidth,
			lineLen = w * delta,
			lineDlt = lineLen + Math.ceil(delta),

			src = me.get_IDAT().buffer,
			dst = new Uint8Array(Math.max(1, Math.ceil(w * delta) * h)),
			filters = [filt0, filt1, filt2, filt3, filt4],

			sPos = 0, dPos = 0, cPos = 0, pPos = 0, y = 0, px,
			buffLen = src.byteLength,
			srcLen = src.length,

			//   Pass:  1  2  3  4  5  6  7
			offsetsX = [0, 4, 0, 2, 0, 1, 0],
			offsetsY = [0, 0, 4, 0, 2, 0, 1],
			stepsX =   [8, 8, 4, 4, 2, 2, 1],
			stepsY =   [8, 8, 8, 4, 4, 2, 2],
			blocksW =  [8, 4, 4, 2, 2, 1, 1],
			blocksH =  [8, 8, 4, 4, 2, 2, 1],
			pass, stepX, stepY, offsetX, blockW, blockH, x;

		me.debug = {
			pixelWidth: pixelWidth,
			byteWidth: byteWidth,
			delta: delta,
			lineLen: lineLen,
			lineDlt: lineDlt,
			filters: [],
			preFilt: -1,
			postFilt: -1,
			srcPos: -1,
			srcLen: src.length,
			pass: 0,
			x: -1,
			stepX: 0,
			stepY: 0,
			stepsX: 0,
			stepsY: 0
		};

		if (ihdr.interlaced) {
			pass = y = offsetX = 0;
			stepX = stepY = blockW = blockH = 8;
			setTimeout(decodeI2, PngToy._delay);
		}
		else {
			setTimeout(decode, PngToy._delay);
		}

		function decode() {

			try {
				var ff, lineEnd, filter, filts = me.debug.filters, block = PngToy._blockSize;

				delta = Math.ceil(delta);

				while(y < h && block > 0) {

					filter = src[sPos++];
					ff = filters[filter];	// line filter: ff(srcPixel, a, b, c)
					if (filts.indexOf(filter) < 0) filts.push(filter);

					lineEnd = Math.min(buffLen, sPos + lineLen);
					cPos = dPos;

					while(sPos < lineEnd) {
						dst[dPos] = ff(src[sPos++], dPos - delta, dPos - lineLen, dPos - lineDlt) & mask;
						dPos++
					}

					pPos = cPos;
					block -= lineLen; y++
				}

				//TODO (optionally) apply sBIT (sub-function)

				(y < h) ? setTimeout(decode, PngToy._delay) : resolve(getBitmap());
			}
			catch(err) {
				reject(err)
			}
		}

		function decodeI1() {

			/*
				TODO:
				- each sub-picture must create a temp destination the wxh of the sub-picture
				- filters are applied to this buffer
				- spread tmp dest to main dest based on pass

				Problem now: filters are based on main dest. at full image size
				- filt0 works, no others.. de-interlacing is OK
			 */

			try {
				var ff, filter, i, block = PngToy._blockSize, filts = me.debug.filters,
					lineEnd,
					tw = (w / stepX)|0,
					th = (h / stepY)|0,
					tLen = tw * th,
					lineLen = tw + 1,
					tmp = new Uint8Array(tLen);

				y = 0;

				while(y < th) {

					filter = src[sPos++];
					if (filts.indexOf(filter) < 0) filts.push(filter);
					ff = filters[filter];

					lineEnd = Math.min(buffLen, Math.ceil(sPos + lineLen));

					cPos = y * lineLen;
					pPos = Math.max(0, cPos - lineLen);

					x = 0;

					while(x < lineLen) {

						dPos = (cPos + x * delta)|0;
						i = 0;

						while(i < pixelWidth) {
							px = ff(src[sPos++], dPos - Math.ceil(delta), dPos - lineLen, dPos - Math.ceil(lineDlt)) & mask;
							dPos++; i++;
						}
						x += delta;
					}

					block -= lineLen;
					y++;
				}

				if (y < h) {
					setTimeout(decodeI, PngToy._delay);
				}
				else {
					if (++pass < 7) {
						y = offsetsY[pass];
						offsetX = offsetsX[pass];
						stepX = stepsX[pass];
						stepY = stepsY[pass];
						blockW = blocksW[pass];
						blockH = blocksH[pass];
						setTimeout(decodeI, PngToy._delay);
					}
					else {
						resolve(getBitmap());
					}
				}
			}
			catch(err) {
				reject(err)
			}
		}

		function decodeI2() {

			/*
				TODO:
				- each sub-picture must create a temp destination the wxh of the sub-picture
				- filters are applied to this buffer
				- spread tmp dest to main dest based on pass

				Problem now: filters are based on main dest. at full image size
				- filt0 works, no others.. de-interlacing is OK
			 */

			try {
				var ff, filter, i, block = PngToy._blockSize, filts = me.debug.filters,
					tw = (w / stepX)|0,
					th = (h / stepY)|0,
					tLen = tw * th,
					tmp = new Uint8Array(tLen);

				//TODO separate unfilter step due to async support

				while(y < h) { // && block > 0

					//todo check empty passes
					if (sPos >= srcLen) {
						y = h; continue
					}

					filter = src[sPos++];

					if (filts.indexOf(filter) < 0) filts.push(filter);
					if (filter < 0 || filter > 4) {
						me.debug.preFilt = src[sPos-2];
						me.debug.postFilt = src[sPos];
						me.debug.srcPos = sPos;
						me.debug.pass = pass;
						me.debug.x = x;
						me.debug.stepX = stepX;
						me.debug.stepY = stepY;
						me.debug.stepsX = w / stepX;
						me.debug.stepsY = h / stepY;
					}

					ff = filters[filter];

					lineEnd = Math.min(buffLen, Math.ceil(sPos + lineLen));

					cPos = y * lineLen;
					pPos = Math.max(0, cPos - lineLen);

					x = offsetX;

					while(x < lineLen) {

						dPos = (cPos + x * delta)|0;
						i = 0;

						while(i < pixelWidth) {
							px = ff(src[sPos++], dPos - Math.ceil(delta), dPos - lineLen, dPos - Math.ceil(lineDlt)) & mask;

							// fill block
							for(var fy = 0, bh = Math.min(blockH, h - y); fy < bh; fy++) {
								for(var fx = 0, line = fy * lineLen, bw = Math.min(blockW, w - x); fx < bw; fx++) {
									dst[dPos + line + fx * delta] = px;
								}
							}

							dPos++; i++;
						}
						x += stepX * delta;
					}

					block -= lineLen;
					y += stepY;
				}

				if (y < h) {
					setTimeout(decodeI2, PngToy._delay);
				}
				else {
					if (++pass < 7) {
						y = offsetsY[pass];
						offsetX = offsetsX[pass];
						stepX = stepsX[pass];
						stepY = stepsY[pass];
						blockW = blocksW[pass];
						blockH = blocksH[pass];
						setTimeout(decodeI2, PngToy._delay);
					}
					else {
						resolve(getBitmap());
					}
				}

				function dstCurrentT(pos) {return pos < cPos ? 0 : tmp[pos]>>>0}							// check against current scanline
				function dstPrevT(pos) {return pos < pPos ? 0 : tmp[pos]>>>0}							// check against previous scanline

			}
			catch(err) {
				reject(err)
			}
		}

		function getBitmap() {
			return {
				bitmap: is16 ? new Uint16Array(dst.buffer) : new Uint8Array(dst.buffer),
				width: w,
				height: h,
				byteWidth: byteWidth,
				pixelWidth: pixelWidth,
				depth: ihdr.depth,
				type: ihdr.type
			}
		}

		function dstCurrent(pos) {return pos < cPos ? 0 : dst[pos]>>>0}							// check against current scanline
		function dstPrev(pos) {return pos < pPos ? 0 : dst[pos]>>>0}							// check against previous scanline

		function filt0(px) {return px}
		function filt1(px, a) {return px + dstCurrent(a)}										// Recon(x) = Filt(x) + Recon(a)
		function filt2(px, a, b) {return px + dstPrev(b)}										// Recon(x) = Filt(x) + Recon(b)
		function filt3(px, a, b) {return px + ((dstCurrent(a) + dstPrev(b))>>>1)} 				// Recon(x) = Filt(x) + floor((Recon(a) + Recon(b)) / 2)
		function filt4(px, a, b, c) {return px + paeth(dstCurrent(a), dstPrev(b), dstPrev(c))}	// Recon(x) = Filt(x) + PaethPredictor(Recon(a), Recon(b), Recon(c))

		function paeth(a, b, c) {
			var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
			if (pa <= pb && pa <= pc) return a;
			if (pb <= pc) return b;
			return c;
		}
	})
};