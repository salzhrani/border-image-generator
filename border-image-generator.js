/*
 * Copyright (c) 2010 Kevin Decker (http://www.incaseofstairs.com/)
 * See LICENSE for license information
 */
 $(document).ready(function() {
    var pathToImage = $("#pathToImage"),
    editorEl = $("#editorEl"),
    imageEl = $("#imageEl"),
    dividers = $(".divider"),
    sliders = $(".slider"),
    fillEl = $("#fillCenter"),
    cssEl = $("#cssEl"),
    svgEl = $("#svgEl"),
    repeat = $(".repeat"),

    validImage = false,
    naturalSize = {},

    state = {
        src: "",

        linkBorder: true,
        borderWidth: [0, 0, 0, 0],
        imageOffset: [0, 0, 0, 0],

        fill: true,
        setRepat: false,
        repeat: ["stretch", "stretch"],

        scaleFactor: 3,
        hash: ""
    };

    var sliderMap = {
        imageTop: { array: "imageOffset", index: 0 },
        imageRight: { array: "imageOffset", index: 1 },
        imageBottom: { array: "imageOffset", index: 2 },
        imageLeft: { array: "imageOffset", index: 3 },

        borderTop: { array: "borderWidth", index: 0 },
        borderRight: { array: "borderWidth", index: 1 },
        borderBottom: { array: "borderWidth", index: 2 },
        borderLeft: { array: "borderWidth", index: 3 }
    }, dividerMap = {
        dividerTop: {
            setValue: function(el) { state.imageOffset[0] = calcPixels($(el).position().top); },
            updatePos: function(el) { $(el).css("top", state.imageOffset[0]*state.scaleFactor); }
        },
        dividerRight: {
            setValue: function(el) { state.imageOffset[1] = calcPixels(editorEl.innerWidth() - $(el).position().left + 2); },
            updatePos: function(el) { $(el).css("left", (editorEl.innerWidth() - 2 - state.imageOffset[1]*state.scaleFactor)); }
        },
        dividerBottom: {
            setValue: function(el) { state.imageOffset[2] = calcPixels(editorEl.innerHeight() - $(el).position().top + 2); },
            updatePos: function(el) { $(el).css("top", (editorEl.innerHeight() - 2 - state.imageOffset[2]*state.scaleFactor)); }
        },
        dividerLeft: {
            setValue: function(el) { state.imageOffset[3] = calcPixels($(el).position().left); },
            updatePos: function(el) { $(el).css("left", state.imageOffset[3]*state.scaleFactor); }
        }
    }, repeatMap = {
        repeatVertical: { index: 1 },
        repeatHorizontal: { index: 0 }
    };

    function calcPixels(pos) {
        return (pos / state.scaleFactor) | 0;
    }
    function updateFill() {
        fillEl[0].checked = !!state.fill;
    }
    function updateSliders() {
        $(".slider").each(function(index, el) {
            var map = sliderMap[el.id];
            $(el).slider("option", "value", state[map.array][map.index]);
        });
    }
    function updateDividers() {
        dividers.each(function(index, el) {
            dividerMap[el.id].updatePos(el);
        });
    }
    function updateRepeat() {
        repeat.each(function(index, el) {
            var map = repeatMap[el.id];
            $(el).val(state.repeat[map.index]);
        });
    }
    function updateHash() {
        HistoryHandler.store(JSON.stringify(state));
    }
    function joinValues(values, join) {
        var ret = [];
        if (values[3] !== undefined && values[3] !== values[1]) {
            ret.unshift(values[3]);
        }
        if (ret.length || (values[2] !== undefined && values[2] !== values[0])) {
            ret.unshift(values[2]);
        }
        if (ret.length || (values[1] !== undefined && values[1] !== values[0])) {
            ret.unshift(values[1]);
        }
        ret.unshift(values[0]);
        return ret.join(join || " ");
    }
    function updateCSS() {
        var borderImage = "", borderWidthStr = "", style = "",
        fillStr = state.fill ? " fill" : "",
        repeatStr = state.setRepeat ? " " + joinValues(state.repeat) : "";

        if (validImage) {
            var img = "url(" + UserImageCache.getDisplayName() + ")",
            imageOffset = state.imageOffset,
            borderWidth = state.linkBorder ? state.imageOffset : state.borderWidth;

            borderImage = img + " " + joinValues(imageOffset);
            borderWidthStr = joinValues(borderWidth, "px ") + "px";
            style = "border-style: solid;\n"
            + "border-width: " + borderWidthStr + ";\n"
            + "-moz-border-image: " + borderImage + repeatStr + ";\n"
            + "-webkit-border-image: " + borderImage + repeatStr + ";\n"
            + "-o-border-image: " + borderImage + repeatStr + ";\n"
            + "border-image: " + borderImage + fillStr + repeatStr + ";\n";

            borderImage = "url(" + UserImageCache.getSrc() + ") " + joinValues(imageOffset);
        }

        $("#cssEl").html(style)
        .css("border-width", borderWidthStr)
        .css("-moz-border-image", borderImage + repeatStr)
        .css("-webkit-border-image", borderImage + repeatStr)
        .css("-o-border-image", borderImage + repeatStr)
        .css("border-image", borderImage + fillStr + repeatStr);
    }
    function updateSVG()
    {
        if (validImage) {
            var elW = cssEl.width(),
            elH = cssEl.height(),
            imgW = naturalSize.width,
            imgH = naturalSize.height,

            // The image cannot be referenced as a URL directly in the SVG because IE9 throws a strange
            // security exception (perhaps due to cross-origin policy within data URIs?) Therefore we
            // work around this by converting the image data into a data URI itself using a transient
            // canvas. This unfortunately requires the border-image src to be within the same domain,
            // which isn't a limitation in true border-image, so we need to try and find a better fix.
            imgSrc = state.hash,

            REPEAT = 'repeat',
            STRETCH = 'stretch',
            ROUND = 'round',
            ceil = Math.ceil,

            // zero = PIE.getLength( '0' ),
            // widths = props.widths || ( borderProps ? borderProps.widths : { 't': zero, 'r': zero, 'b': zero, 'l': zero } ),
            widthT = state.borderWidth[0],
            widthR = state.borderWidth[1],
            widthB = state.borderWidth[2],
            widthL = state.borderWidth[3],
            // slices = props.slice,
            sliceT = state.imageOffset[0],
            sliceR = state.imageOffset[1],
            sliceB = state.imageOffset[2],
            sliceL = state.imageOffset[3],
            centerW = elW - widthL - widthR,
            middleH = elH - widthT - widthB,
            imgCenterW = imgW - sliceL - sliceR,
            imgMiddleH = imgH - sliceT - sliceB,

            // Determine the size of each tile - 'round' is handled below
            tileSizeT = state.repeat[0] === STRETCH ? centerW : imgCenterW * widthT / sliceT,
            tileSizeR = state.repeat[1] === STRETCH ? middleH : imgMiddleH * widthR / sliceR,
            tileSizeB = state.repeat[0] === STRETCH ? centerW : imgCenterW * widthB / sliceB,
            tileSizeL = state.repeat[1] === STRETCH ? middleH : imgMiddleH * widthL / sliceL,

            svg,
            patterns = [],
            rects = [],
            i = 0;

            // For 'round', subtract from each tile's size enough so that they fill the space a whole number of times
            if (state.repeat[0] === ROUND) {
                tileSizeT -= (tileSizeT - (centerW % tileSizeT || tileSizeT)) / ceil(centerW / tileSizeT);
                tileSizeB -= (tileSizeB - (centerW % tileSizeB || tileSizeB)) / ceil(centerW / tileSizeB);
            }
            if (state.repeat[1] === ROUND) {
                tileSizeR -= (tileSizeR - (middleH % tileSizeR || tileSizeR)) / ceil(middleH / tileSizeR);
                tileSizeL -= (tileSizeL - (middleH % tileSizeL || tileSizeL)) / ceil(middleH / tileSizeL);
            }


            // Build the SVG for the border-image rendering. Add each piece as a pattern, which is then stretched
            // or repeated as the fill of a rect of appropriate size.
            svg = [
            '<svg width="' + elW + '" height="' + elH + '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'
            ];

            function addImage( x, y, w, h, cropX, cropY, cropW, cropH, tileW, tileH ) {
                patterns.push(
                    '<pattern patternUnits="userSpaceOnUse" id="pattern' + i + '" ' +
                    'x="' + (state.repeat[0] === REPEAT ? x + w / 2 - tileW / 2 : x) + '" ' +
                    'y="' + (state.repeat[1] === REPEAT ? y + h / 2 - tileH / 2 : y) + '" ' +
                    'width="' + tileW + '" height="' + tileH + '">' +
                    '<svg width="' + tileW + '" height="' + tileH + '" viewBox="' + cropX + ' ' + cropY + ' ' + cropW + ' ' + cropH + '" preserveAspectRatio="none">' +
                    '<image xlink:href="' + imgSrc + '" x="0" y="0" width="' + imgW + '" height="' + imgH + '" />' +
                    '</svg>' +
                    '</pattern>'
                    );
                rects.push(
                    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#pattern' + i + ')" />'
                    );
                i++;
            }
                addImage( 0, 0, widthL, widthT, 0, 0, sliceL, sliceT, widthL, widthT ); // top left
                addImage( widthL, 0, centerW, widthT, sliceL, 0, imgCenterW, sliceT, tileSizeT, widthT ); // top center
                addImage( elW - widthR, 0, widthR, widthT, imgW - sliceR, 0, sliceR, sliceT, widthR, widthT ); // top right
                addImage( 0, widthT, widthL, middleH, 0, sliceT, sliceL, imgMiddleH, widthL, tileSizeL ); // middle left
                if ( state.fill ) { // center fill
                    addImage( widthL, widthT, centerW, middleH, sliceL, sliceT, imgCenterW, imgMiddleH, 
                      tileSizeT || tileSizeB || imgCenterW, tileSizeL || tileSizeR || imgMiddleH );
                }
                addImage( elW - widthR, widthT, widthR, middleH, imgW - sliceR, sliceT, sliceR, imgMiddleH, widthR, tileSizeR ); // middle right
                addImage( 0, elH - widthB, widthL, widthB, 0, imgH - sliceB, sliceL, sliceB, widthL, widthB ); // bottom left
                addImage( widthL, elH - widthB, centerW, widthB, sliceL, imgH - sliceB, imgCenterW, sliceB, tileSizeB, widthB ); // bottom center
                addImage( elW - widthR, elH - widthB, widthR, widthB, imgW - sliceR, imgH - sliceB, sliceR, sliceB, widthR, widthB ); // bottom right

                svg.push(
                    '<defs>' +
                    patterns.join('\n') +
                    '</defs>' +
                    rects.join('\n') +
                    '</svg>'
                    );
                $('#svgEl').html(svg.join( '' ));
            }

        }
        fillEl.change(function() {
            state.fill = this.checked;
            updateCSS();
            updateSVG();
            updateHash();
        });

        sliders.slider({
            max: 100,
            slide: function(event, ui) {
                var map = sliderMap[event.target.id];
                state[map.array][map.index] = ui.value;

                updateCSS();
                updateSVG();
                updateDividers();
            },
            stop: function() {
                updateHash();
            }
        });
        dividers.draggable({
            containment: "parent",
            drag: function(event, ui) {
                dividerMap[event.target.id].setValue(event.target);
                updateCSS();
                updateSVG();
                updateSliders();
            },
            stop: function() {
                updateHash();
            }
        });
        dividers.filter(":even").draggable("option", "axis", "y");
        dividers.filter(":odd").draggable("option", "axis", "x");

        repeat.change(function() {
            var map = repeatMap[this.id];
            state.repeat[map.index] = $(this).val();
            updateCSS();
            updateSVG();
            updateHash();
        });

        UserImageCache.setImageEl(imageEl[0]);
        imageEl.load(function() {
            var img = this,
            natWidth = img.naturalWidth || img.width,
            natHeight = img.naturalHeight || img.height,
            width = natWidth*state.scaleFactor,
            height = natHeight*state.scaleFactor;

        // Ensure that the initial scale for the image is always smaller that the size of the screen
        if (width > window.innerWidth || height > window.innerHeight) {
            state.scaleFactor = Math.min(window.innerWidth/width, window.innerHeight/height);
            width = natWidth*state.scaleFactor;
            height = natHeight*state.scaleFactor;
        }

        naturalSize = {
            width: natWidth,
            height: natHeight
        };

        // Correct for any HTTP escaping issues in the input
        state.src = UserImageCache.getEntryId();
        pathToImage.val(UserImageCache.getDisplayName());

        state.hash = this.src;

        editorEl.width(width).height(height);
        editorEl.show();

        $(".errorMsg").hide();
        validImage = true;

        // svg




        sliders.filter(":odd").slider("option", "max", natWidth);
        sliders.filter(":even").slider("option", "max", natHeight);
        updateSliders();
        updateDividers();
        updateCSS();
        updateSVG();
        updateHash();
    });

function errorHandler(code) {
    var msg;
    if (code === FileError.NOT_FOUND_ERR) {
        msg = "Unable to find image. This may be due to an incorrect path name or a local file that has not been properly loaded.";
    } else if (code) {
        msg = "Failed to load image. Error code: " + code;
    } else {
        msg = "Unknown error occured loading image " + UserImageCache.getDisplayName();
    }

        // Only show the message if the user as attempted to load an image
        if (UserImageCache.getEntryId()) {
            $(".errorMsg").html("*** " + msg).show();
        }

        editorEl.hide();
        validImage = false;

        updateCSS();
        updateSVG();
    }
    imageEl.error(function() { errorHandler(); });
    pathToImage.change(function(event) {
        // Clear the frame size so Opera can scale the editor down if the new image is smaller than the last
        editorEl.width("auto").height("auto");
        UserImageCache.load(pathToImage.val(), errorHandler);
    });

    function setFlag(name, value) {
        return function() {
            state[name] = value;
            updateCSS();
            updateSVG();
            updateHash();
        };
    }
    $("#borderOptionsExpander").expander("#borderOptions", setFlag("linkBorder", false), setFlag("linkBorder", true));
    $("#repeatOptionsExpander").expander("#repeatOptions", setFlag("setRepeat", true), setFlag("setRepeat", false));

    editorEl.resizable({
        reverseXAxis: true,
        handles: "s, w, sw",
        aspectRatio: true,
        resize: function() {
            state.scaleFactor = editorEl.innerWidth() / naturalSize.width;

            updateSliders();
            updateDividers();
            updateCSS();
            updateSVG();
        },
        stop: function() {
            updateHash();
        }
    });

    if (UserImageCache.isLocalSupported()) {
        $("body").bind("dragenter dragover", function(event) {
            // We have to cancel these events or we will not recieve the drop event
            event.preventDefault();
            event.stopPropagation();
        });
        $("body").bind("drop", function(event) {
            event.preventDefault();
            event.stopPropagation();
            var dataTransfer = event.originalEvent.dataTransfer,
            file = dataTransfer.files[0];

            UserImageCache.load(file, errorHandler);
        });
        $("#localImage").bind("change", function(event) {
            var file = this.files[0];

            UserImageCache.load(file, errorHandler);
        });

        $("body").removeClass("no-local");
    }

    HistoryHandler.init(function(hash) {
        var prevScale = state.scaleFactor;

        if (hash) {
            $.extend(state, JSON.parse(hash));
        }
        if ($("#borderOptions").is(":visible") === state.linkBorder) {
            $("#borderOptionsExpander").click();
        }
        if ($("#repeatOptions").is(":visible") !== state.setRepeat) {
            $("#repeatOptionsExpander").click();
        }

        updateFill();

        if (UserImageCache.getEntryId() !== state.src) {
            // The other values will update when the image loads
            UserImageCache.load(state.src, errorHandler);
        } else if (prevScale !== state.scaleFactor) {
            imageEl.load();
        } else {
            updateSliders();
            updateDividers();
            updateCSS();
            updateSVG();
        }

        updateRepeat();
    });
});
