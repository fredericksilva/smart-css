var _                   = require('lodash');
var tinycolor           = require('tinycolor2');
var mediaQueryValidator = require('valid-media-queries');
var escapeHTML          = require('escape-html');
var StyleClass          = require('./StyleClass');
var Slick               = require('slick');
var util                = require('util');

// console.log(util.inspect(Slick.parse('.a:hover .basda2-12::select'), {depth:12}));




/**
 * @class core.SmartCSS
 * An utility class which can be used to save CSS styles
 * and get their id. Use an instance per module.
 *
 * Definitions:
 *  - Class id: is the name in smart-css, normally is semantic and needs context; A class
 *              id only matters if has a SmartCSS instance associated. Alone means nothing.
 *  - Class name: is the real css class, normally is ugly and short; Doesn't include the pseudo
 *                part or the dot prefix.
 *
 * @param {Object} options
 * @param {Boolean} [options.prefixClassId=true]
 *        Prefixes all style ids with the style name.
 *        For example if you you set this to true the class names
 *        generated will have the prefix the style name and then
 *        the id.
 */
var SmartCSS = function(options){
    options = _.extend({
        prefixClassId : true,
    }, SmartCSS.getDefaultOptions, options);

    this.__prefixClassId = options.prefixClassId;

    /**
     * The key is the styleName and the value is an object like this:
     * `{className: 'String', style: {color: 'red'}}`
     * @type {Object}
     * @private
     */
    this.__styleClasses = {};
    // The key is classId and maps to a className.
    this.__classNameMap = {};
    SmartCSS.registerContext(this);
}




SmartCSS.__data = {
    styles   : {},
    contexts : [],
    id       : 0,
};




SmartCSS.registerContext = function(context){
    SmartCSS.__data.contexts.push(context);
}




SmartCSS.__getNextId = function(){
    return SmartCSS.__data.id++;
}



/**
 * After you add the styles call this function to apply the styles.
 */
SmartCSS.injectStyles = function(){
    var tag = document.createElement('style');
    tag.innerHTML = SmartCSS.getStylesAsString();
    document.getElementsByTagName('head')[0].appendChild(tag);
}



SmartCSS.deleteStyles = function(){
    SmartCSS.__data.styles = {};
    SmartCSS.__data.contexts = [];
}



/**
 * After you add the styles call this function to get the styles as string.
 * @todo: add it as an instance method.
 */
SmartCSS.getStylesAsString = function(){
    var contexts = SmartCSS.__data.contexts;
    var str = '';
    contexts.forEach(function(context){
        context.getStyleClasses().forEach(function(styleClass){
            str += renderStyleClass(styleClass);
        })
    })
    return str;
}

var renderStyleClass = function(styleClass){
    var styleDef = styleClass.getStyleDef();
    var styleBody = '';
    for(var key in styleDef){
        if(!styleDef.hasOwnProperty(key)){
            continue;
        }
        styleBody += ruleToString(key, styleDef[key]);
    }

    // var hover = styleClass.getHover();
    var styleHeader = '.' + styleClass.getClassName() + styleClass.getPseudo();
    // if(hover === true){
    //     styleHeader += ':hover';
    // }else if(hover){
    //     var smartCss = styleClass.getSmartCss();
    //     styleHeader = '.' + smartCss.getClass(hover) + ':hover ' + styleHeader;
    // }

    var styleFull = styleHeader + '{' + styleBody + '}';

    var media = styleClass.getMedia();
    if(media){
        styleFull = '@media (' + media + '){' + styleFull + '}'
    }
    return styleFull;
}


var rulesToString = function(className, styleObj){
    var markup       = '';
    var pseudos      = '';
    var mediaQueries = '';

    for(var key in styleObj){
        if(!styleObj.hasOwnProperty(key)){
            continue;
        }
        // Skipping the special pseudo-selectors and media queries.
        if(key[0] === ':'){
            pseudos += '.' + className + key + '{' +
                _rulesToStringHeadless(styleObj[key]) + '}';
        }else if(key.substring(0, 6) === '@media'){
            if(!mediaQueryValidator(key)){
                console.log('%s is not a valid media query.', key);
                continue;
            }
            mediaQueries += key + '{' + rulesToString(className, styleObj[key]) + '}';
        }else{
            markup += ruleToString(key, styleObj[key]);
        }
    }

    if(markup !== ''){
        markup = '.' + className + '{' + markup + '}';
    }

    return markup + pseudos + mediaQueries;
}

var _rulesToStringHeadless = function(styleObj){
    var markup = '';

    for(var key in styleObj){
        if(!styleObj.hasOwnProperty(key)){
            continue;
        }

        if(key[0] === ':' || key.substring(0, 6) === '@media'){
            continue;
        }
        markup += ruleToString(key, styleObj[key]);
    }
    return markup;
}
var ruleToString = function(propName, value){
    var cssPropName = hyphenateProp(propName);
    if(value instanceof tinycolor) value = value.toHslString();
    return cssPropName + ':' + escapeValueForProp(value, cssPropName) + ';';
}
var _uppercasePattern = /([A-Z])/g;
var msPattern = /^ms-/;
var hyphenateProp = function(string){
    // MozTransition -> -moz-transition
    // msTransition -> -ms-transition. Notice the lower case m
    // http://modernizr.com/docs/#prefixed
    // thanks a lot IE
    return string.replace(_uppercasePattern, '-$1')
        .toLowerCase()
        .replace(msPattern, '-ms-');
}
var escapeValueForProp = function(value, prop){
    return value;
    // Still don't know why I should escape values?!
    // return escapeHTML(value);
}


SmartCSS.registerClass = function(styleObj, options){
    options = _.extend({
        prefix    : 'c',
        postfix   : void 0,
        className : void 0,
        media     : void 0,
        pseudo    : void 0,
        smartCss  : void 0,
    }, options);
    var className;
    if(options.className === void 0){
        className = SmartCSS.__data.id;
        if(options.prefix !== void 0){
            className = options.prefix + className;
        }
        if(options.postfix !== void 0){
            className = className + options.postfix;
        }
        SmartCSS.__data.id++;
    }else{
        className = options.className;
    }
    var styleDef = new StyleClass({
        className : className,
        styleDef  : styleObj,
        hover     : options.hover,
        media     : options.media,
        smartCss  : options.smartCss
    })
    SmartCSS.__data.styles[styleId] = styleDef;
    return styleDef;
}





_.extend(SmartCSS.prototype, {



    /**
     * Gets the style id of a style name.
     * Don't add any pseudo things. For example if you set a class like this:
     *
     *     setClass('myClass:hover', ...);
     *
     * In order to get the className you do:
     *
     *     getClass('myClass');
     *
     * And not
     *
     *     getClass('myClass:hover');
     *
     * @param  {String} styleName
     * @return {String} The class id. This is the real class that is attached to the DOM.
     */
    getClass: function(classId){
        // Warn if class is missing and return '' by default.
        if(this.__classNameMap[classId] === void 0){
            console.warn('Class "' + classId + '" not set.');
            return '';
        }
        return this.__classNameMap[classId];
    },



    getStyleClasses: function(){
        return _.values(this.__styleClasses);
    },



    /**
     * Returns multiple classes.
     * Example:
     *
     *     css.getClasses({
     *         a: true,
     *         b: false,
     *         c: true,
     *     });
     *     // Will return a string with the class for `a` and `b` only.
     * @param {Object} styleNames Example {returnThisClass: true, dontReturnThisClass: false}
     * @param {Boolean} [asArray=true] If true returns an array, if not returns a string.
     * @return {String} The classes' ids. These are the real classes that are attached to the DOM.
     */
    getClasses: function(styleNames, asArray){
        var classesAsArray = [];
        _.forEach(styleNames, function(include, styleName){
            if(include){
                classesAsArray.push(this.getClass(styleName));
            }
        }.bind(this))
        if(asArray){
            return classesAsArray;
        }else{
            return classesAsArray.join(' ');
        }
    },



    /**
     * Returns an object where the key is the friendly class name
     * and the value is an object with 2 keys: className and style.
     * @return {Object}
     */
    getClassesAsMap: function(){
        return _.clone(this.__styleClasses);
    },



    /**
     * Defines a style.
     * @param {String} name The style name, then you can get the style id with `getClass` or `getClasses`.
     * @param {Object} def The style definition `{color: 'red'}` as javascript object.
     * @param {Object} options
     * @param {String} options.className
     * @param {String} options.hover
     * @param {String} options.media
     */
    setClass: function(selector, styleDef, options){
        var classId = selector.split(':')[0];
        var pseudo  = selector.split(':');
        pseudo[0] = '';
        pseudo = pseudo.join(':');

        options = _.extend({
            smartCss  : this,
            className : void 0,
            pseudo    : pseudo,
            classId   : classId,
        }, options)

        if(options.className === void 0){
            var className = 'c';
            // If a class with the same classId has been defined then reuse
            // its className so :hover and other pseudo things works correctly.
            if(this.__styleClasses[classId]){
                className = this.__styleClasses[classId].getClassName();
            }
            if(this.__prefixClassId){
                className += '-' + classId;
            }
            className += '-' + SmartCSS.__getNextId();
            options.className = className;
        }

        var styleClass = new StyleClass({
            className : options.className,
            pseudo    : pseudo,
            styleDef  : styleDef,
            media     : options.media,
            smartCss  : options.smartCss
        })
        this.__classNameMap[classId] = className;
        this.__styleClasses[classId + pseudo] = styleClass;
        return this.__styleClasses[classId + pseudo];
    }



})





module.exports = SmartCSS;
