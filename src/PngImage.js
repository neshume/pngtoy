/*
	PngImage() object for easy-loading raw PNGs

	pngtoy
	By Ken Nilsen / Epistemex (c) 2015
	www.epistemex.com
 */
/**
 * Emulates the Image object but will load a PNG image without applying
 * gamma, ICC etc.
 *
 * NOTE: An important distinction is that you need to pass in
 * `img.bitmap` to canvas instead of just `img`.
 * @constructor
 */
function PngImage() {

	var url = "",
		me = this,
		crossOrigin = null,
		png = new PngToy(), bmp, canvas,
		w = 0, h = 0, complete = false;

	this.onload = null;
	this.onerror = null;

	Object.defineProperty(this, "src", {
		get: function() {return url},
		set: function(v) {
			url = v;
			start()
		}
	});

	/*Object.defineProperty(this, "crossOrigin", {
		get: function() {return crossOrigin},
		set: function(co) {
			if (co !== "anonymous" || co !== "use-credentials") co = "anonymous";
			crossOrigin = co;
		}
	});*/

	Object.defineProperty(this, "width", {get: function() {return w}});
	Object.defineProperty(this, "height", {get: function() {return h}});
	Object.defineProperty(this, "naturalWidth", {get: function() {return w}});
	Object.defineProperty(this, "naturalHeight", {get: function() {return h}});
	Object.defineProperty(this, "image", {get: function() {return canvas}});
	Object.defineProperty(this, "pngtoy", {get: function() {return png}});
	Object.defineProperty(this, "complete", {get: function() {return complete}});

	function start() {png.fetch(url).then(decode, error)}		// todo need to support CORS (options)
	function decode(bmpO) {png.decode(bmpO).then(convert, error)}

	function convert(bmpO) {
		bmp = bmpO;
		w = bmpO.width;
		h = bmpO.height;

		png.convertToCanvas(bmpO, {
			ignoreAspectRatio: false,
			useGamma         : false
		}).then(success.bind(me), error.bind(me));
	}

	function success(canvasO) {
		canvas = canvasO;
		complete = true;
		if (me.onload) me.onload({
			timeStamp: Date.now()
		})
	}

	function error(msg) {
		if (me.onerror) me.onerror({
			message: msg,
			timeStamp: Date.now()
		})
	}
}