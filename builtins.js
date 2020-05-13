var __MINILANG__ = {} // global object with baragwin built-ins

;(function($M) {

$M.version = "0.0.1"

// File cache
$M.file_cache = {}

// Maps the name of imported modules to the module object
$M.imported = {}

// Frames stack
$M.frames_stack = []

// Python __builtins__
$M.builtins = {}

// system language ( _not_ the one set in browser settings)
// cf http://stackoverflow.com/questions/1043339/javascript-for-detecting-browser-language-preference
$M.language = window.navigator.userLanguage || window.navigator.language

// minimum and maximum safe integers
$M.max_int = Math.pow(2, 53) - 1
$M.min_int = -$M.max_int

// Used to compute the hash value of some objects (see
// py_builtin_functions.js)
$M.$py_next_hash = Math.pow(2, 53) - 1

// $py_UUID guarantees a unique id.  Do not use this variable
// directly, use the $M.UUID function defined in py_utils.js
$M.$py_UUID = 0

$M.scripts = {} // for Python scripts embedded in a JS file

$M.get_class = function(obj){
    switch(typeof obj) {
        case "number":
            if(obj % 1 === 0){ // this is an int
               return "int"
            }
            // this is a float
            return "float"
        case "string":
            return "str"
        case "function":
            return "function"
        case "object":
            if(obj instanceof Array){
                return "list"
            }else if(obj instanceof Map){
                return "table"
            }else if(obj instanceof Number){
                return "float"
            }else if(obj.$is_struct_type){
                return "struct"
            }else if(obj.$is_struct_instance){
                return "struct_instance"
            }
            break
    }
    throw $M.Error("unknown class for object " + obj)
}

function is_number(x){
    return ["int", "float"].indexOf($M.get_class(x)) > -1
}

$M.class_name = function(obj){
    return $M.get_class(obj).__name__
}

$M.compare = {
    error: function(op, x, y){
        throw $M.Error("cannot compare " + $M.get_class(x) + " and " +
            $M.get_class(y) + " with " + op)
    },
    eq: function(x, y){
        if(is_number(x) && is_number(y)){
            return x.valueOf() == y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x == y
        }else if(Array.isArray(x) && Array.isArray(y)){
            if(x.length == y.length){
                for(var i = 0, len = x.length; i < len; i++){
                    if(!$M.compare.eq(x[i], y[i])){
                        return false
                    }
                }
                return true
            }
            return false
        }else{
            $M.compare.error("==", x, y)
        }
    },
    ge: function(x, y){
        if(is_number(x) && is_number(y)){
            return x.valueOf() >= y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x >= y
        }else{
            $M.compare.error(">=", x, y)
        }
    },
    gt: function(x, y){
        if(is_number(x) && is_number(y)){
            return x.valueOf() > y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x > y
        }else{
            $M.compare.error(">", x, y)
        }
    },
    le: function(x, y){
        if(is_number(x) && is_number(y)){
            return x.valueOf() <= y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x <= y
        }else if(x.$is_struct_type || x.$is_struct_instance){
            // syntax t <= item
            x.$items.push(y)
        }else{
            $M.compare.error("<=", x, y)
        }
    },
    lt: function(x, y){
        if(is_number(x) && is_number(y)){
            return x.valueOf() < y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x < y
        }else{
            $M.compare.error("<", x, y)
        }
    }
}

$M.enter_frame = function(frame){
    // Enter execution frame : save on top of frames stack
    $M.frames_stack.push(frame)
}

$M.leave_frame = function(arg){
    // Leave execution frame
    if($M.frames_stack.length == 0){console.log("empty stack"); return}
    $M.del_exc()
    $M.frames_stack.pop()
}

function slice_to_index(keys, obj){
    // convert slice keys relatively to object
    var len = obj.length
    if(keys[0] === undefined){
        keys[0] = 0
    }else if(keys[0] < 0){
        keys[0] = len + keys[0]
    }
    if(keys[1] === undefined){
        keys[1] = len
    }else if(keys[1] < 0){
        keys[1] = len + keys[1]
    }
}

$M.getattr = function(obj, key){
    if(obj.$is_struct_instance){
        var res = obj.$keywords[key]
        if(res !== undefined){
            return res
        }else{
            res = obj.$type.$keywords[key]
            if(res !== undefined){
                return res
            }
        }
        throw $M.Error(`attribute error ${key}`)
    }else if(obj.$is_struct_type){
        var res = obj.$keywords[key]
        if(res !== undefined){
            return res
        }
        throw $M.Error(`attribute error ${key}`)
    }
    var res = obj[key]
    if(res === undefined){
        if(obj.$ns && obj.$ns[key] !== undefined){
            return obj.$ns[key]
        }
        console.log("obj", obj, "key", key)
        throw $M.Error("attribute error: " + key)
    }
    return res
}

$M.setattr = function(obj, key, value){
    if(obj.$is_struct_type){
        obj.$attrs[key] = value
    }else{
        obj[key] = value
    }
}

$M.getitem = function(obj, key){
    if(obj.$is_struct_type){
        if(typeof key == "number"){
            if(key < 0){
                key = key + obj.$items.length
            }
            var res = obj.$items[key]
        }else if(typeof key == "string"){
            var res = obj.$keywords[key]
        }else if(key instanceof Array){
            // slice
            slice_to_index(key, obj.$items)
            return $M.table(obj.$items.slice(key[0], key[1]))
        }else{
            throw $M.Error("wrong index type: " + $get_class(key))
        }
        if(res === undefined){
            throw $M.Error("unknown key: " + key)
        }
        return res
    }else if(obj.$is_struct_instance){
        if(typeof key == "number"){
            var res = obj.$items[key]
        }else if(typeof key == "string"){
            var res = obj.$keywords[key]
        }else if(key instanceof Array){
            // slice
            slice_to_index(key, obj.$items)
            return obj.$type(obj.slice(key[0], key[1]))
        }else{
            throw $M.Error("wrong index type: " + $get_class(key))
        }
        if(res === undefined){
            res = $M.getitem(obj.$type, key)
            if(res === undefined){
                throw $M.Error("unknown key: " + key)
            }
        }
        return res
    }else if(typeof obj == "string"){
        if(key == "len"){
            return obj.length
        }else if($M.get_class(key) == "int" &&
                obj.charAt(key) !== undefined){
            return obj.charAt(key)
        }else if(key instanceof Array){
            slice_to_index(key, obj)
            return obj.substring(key[0], key[1])
        }
        throw $M.Error("unknown key: " + key)
    }
}

$M.setitem = function(obj, key, value){
    if(obj.$is_struct_type || obj.$is_struct_instance){
        if(typeof key == "number"){
            if(obj.$items[key] !== undefined){
                obj.$items[key] = value
                return
            }
            throw $M.Error("unknown key: " + key)
        }else if(typeof key == "string"){
            obj.$keywords[key] = value
        }else if(key instanceof Array){
            // remove slice, replace it by value
            slice_to_index(key, obj.$items)
            obj.$items.splice(key[0], key[1] - key[0])
            for(var i = value.length - 1; i >= 0; i--){
                obj.$items.splice(key[0], 0, value[i])
            }
            return
        }else{
            throw $M.Error("invalid key type: " + $M.get_class(key))
        }
    }
    throw $M.Error("cannot set item to " + $M.get_class(obj))
}


$M.del_exc = function(){
    var frame = $M.last($M.frames_stack)
    delete frame.current_exception
}

$M.operations = {
    error: function(op, x, y){
        throw $M.Error(op + " not supported between " + $M.get_class(x) +
                    " and " + $M.get_class(y))
    },
    add: function(x, y){
        if(is_number(x) && is_number(y)){
            return x.valueOf() + y.valueOf()
        }else if(typeof x == "string" && typeof y == "string"){
            return x + y
        }else if(Array.isArray(x) && Array.isArray(y)){
            return x.slice().concat(y)
        }else{
            $M.operations.error("+", x, y)
        }
    },
    div: function(x, y){
        if(is_number(x) && is_number(y)){
            return x.valueOf() / y.valueOf()
        }else if(x.__class__ && x.__class__.div){
            return x.__class__.div([x, y])
        }else{
            $M.operations.error("/", x, y)
        }
    },
    floordiv: function(x, y){
        if(is_number(x) && is_number(y)){
            return Math.floor(x.valueOf() / y.valueOf())
        }else{
            $M.operations.error("//", x, y)
        }
    },
    mod: function(x, y){
        if(is_number(x) && is_number(y)){
            return x.valueOf() % y.valueOf()
        }else{
            $M.operations.error("%", x, y)
        }
    },
    mul: function(x, y){
        if(is_number(x) && is_number(y)){
            if(x instanceof Number || y instanceof Number){
                return new Number(x * y)
            }else{
                return x.valueOf() * y.valueOf()
            }
        }else{
            $M.operations.error("*", x, y)
        }
    },
    sub: function(x, y){
        if(is_number(x) && is_number(y)){
            return x.valueOf() - y.valueOf()
        }else if(x instanceof Array &&
                typeof y == "number"){
            x.splice(y, 1)
        }else{
            $M.operations.error("-", x, y)
        }
    }
}


$M.repr = function(obj){
    if(typeof obj == "boolean"){
        return obj.toString()
    }else if(is_number(obj)){
        return obj.toString()
    }else if(typeof obj == "string"){
        return obj.replace(/ /g, '\xa0')
    }else if(obj instanceof Array){
        var items = []
        for(const item of obj){
            items.push($M.str(item))
        }
        return '[' + items.join(', ') + ']'
    }else if(typeof obj == "function"){
        return 'function ' + obj.$name
    }else if(obj.$is_struct_type || obj.$is_struct_instance){
        var elts = []
        for(const item of obj.$items){
            elts.push($M.repr(item))
        }
        for(var key in obj.$keywords){
            elts.push(`${key}=${$M.repr(obj.$keywords[key])}`)
        }
        res = obj.$is_struct_type ? '<table> ' : '<instance> '
        res += `[${elts.join(', ')}]`
        return res
    }else{
        return '<unprintable>'
    }
}

$M.str = function(obj){
    if(typeof obj == "string"){
        if(obj.search("'") == -1){
            return "'" + obj + "'"
        }else if(obj.search('"') == -1){
            return '"' + obj + '"'
        }else{
            return "'" + obj.replace(new RegExp("'", "g"), "\\'") + "'"
        }
    }else{
        return $M.repr(obj)
    }
}


var height = 18,
    pos = [0, height],
    svgns = 'http://www.w3.org/2000/svg'

$M.display = function(){
    var args = []
    for(var i = 0, len = arguments.length; i < len; i++){
        args.push($M.repr(arguments[i]))
    }
    var text = args.join(" ")
    var output = document.getElementById("output")
    if(output.nodeName.toUpperCase() == "SVG"){
        var txtElem = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txtElem.setAttributeNS(null, "x", pos[0])
        txtElem.setAttributeNS(null, "y", pos[1])
        txtElem.setAttributeNS(null, "class", "output-text")
        txtElem.appendChild(document.createTextNode(text))
        output.appendChild(txtElem)
        pos[1] += height
    }else if(output.nodeName == "TEXTAREA"){
        output.value += text + "\n"
    }
}

$M.reset_output = function(){
    var output = document.getElementById("output")
    if(output.nodeName.toUpperCase == "SVG"){
        while(output.childNodes.length){
            output.firstChild.remove()
        }
        pos[0] = 0
        pos[1] = height
    }else if(output.nodeName == "TEXTAREA"){
        output.value = ""
    }
}

$M.search = function(name){
    if(name == "print"){
        return $M.display
    }else{
        var frame = $M.frames_stack[$M.frames_stack.length - 1],
            res = frame[name]
        if(res !== undefined){
            return res
        }
    }
    throw $M.Error("Name error: " + name)
}

$M.range = function(start, stop){
    if(start === undefined){
        start = 0
    }
    if(stop === undefined){
        throw $M.Error("No stop value for range")
    }
    if(typeof start != "number"){
        throw $M.Error("start is not an integer")
    }
    if(typeof stop != "number"){
        throw $M.Error("stop is not an integer")
    }
    var res = []
    for(var i = start; i < stop; i++){
        res.push(i)
    }
    return res
}

$M.struct = function(attrs){
    var klass = function(){
        var res = {
            $is_struct_instance: true,
            $type: klass
        }
        var params = Object.keys(klass.$attrs)
        for(var i = 0, len = arguments.length; i < len; i++){
            res[params[i]] = arguments[i]
        }
        return res
    }

    klass.$is_struct_type = true
    klass.$attrs = {}
    for(var key in attrs){
        if(! key.startsWith("$")){
            klass.$attrs[key] = attrs[key]
        }
    }

    return klass
}

$M.table = function(items, keywords){
    var keys = Object.keys(keywords)
    var klass = function(){
        var res = {
            $is_struct_instance: true,
            $items: [],
            $keywords: {},
            $type: klass
        }
        for(var i = 0, len = arguments.length; i < len; i++){
            if(i < items.length){
                res.$items.push(arguments[i])
            }else if(i < items.length + keys.length){
                res.$keywords[keys[i - items.length]] = arguments[i]
            }else{
                throw $M.Error(`too many arguments: ${arguments.length}` +
                    `, expected at most ${items.length + keys.length}`)
            }
        }
        return res
    }

    klass.$is_struct_type = true
    klass.$items = items
    klass.$keywords = keywords
    klass[Symbol.iterator] = function*(){
        for(const item of klass.$items){
            yield item
        }
        for(var key in klass.$keywords){
            yield [key, klass.$keywords[key]]
        }
    }

    return klass
}


$M.use = function(module, code){
    var root = $M.ml2js(code, module, module),
        js = root.to_js()
    js += ";return locals"
    console.log(js)
    var locals = new Function("locals_" + module, js)({})

    var frame = $M.frames_stack[$M.frames_stack.length - 1]
    $M.imported[module] = locals
}

})(__MINILANG__)
