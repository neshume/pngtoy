/*
	Convert to canvas

	pngtoy
	By Ken Nilsen / Epistemex (c) 2015
	www.epistemex.com
 */
PngToy.prototype.convertToCanvas = function(bmp, options) {

	var me = this;

	options = options || {};

	return new Promise(function(resolve, reject) {

		me.convertToRGBA(bmp, options)
			.then(function(bmp) {

				try {
					var canvas = document.createElement("canvas"),
						ctx = canvas.getContext("2d");

					canvas.width = bmp.width;
					canvas.height = bmp.height;

					var idata = ctx.createImageData(bmp.width, bmp.height);
					idata.data.set(bmp.bitmap);
					ctx.putImageData(idata, 0, 0);

					// ratio support
					if ((bmp.ratioY !== 1 || bmp.ratioX !== 1) && !options.ignoreAspectRatio) {
						var tcanvas = document.createElement("canvas"),
							tctx = tcanvas.getContext("2d"), w, h;
						if (bmp.ratioY >= 1) {
							w = canvas.width;
							h = (canvas.height * bmp.ratioY)|0;
						}
						else if (bmp.ratioY < 1) {
							w  = (canvas.width * bmp.ratioX)|0;
							h = canvas.height;
						}
						tcanvas.width = w;
						tcanvas.height = h;
						tctx.drawImage(canvas, 0, 0, w, h);
						canvas = tcanvas;
					}

					resolve(canvas);
				}
				catch(err) {reject(err)}
			},
			reject)
		}
	)
};
