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

$M.Error = function(message){
    var err = Error(message)
    err.stack = $M.frames_stack.slice()
    return err
}

$M.handle_error = function(err){
    var src = $M.src,
        lines = src.split("\n")
    if(err.type == "SyntaxError"){
        $M.display("Syntax error: " + err.msg)
        $M.display("line " + err.line_num)
        $M.display(src.split("\n")[err.line_num - 1])
        var start = err.pos
        while(start >= 0 && src[start] != '\n'){
            start--
        }
        var nb = Math.max(err.pos - start - 1, 0)
        $M.display(' '.repeat(nb) + '^')
    }else{
        $M.display(err.message)
        console.log(err)
        for(var i = 0, len = err.stack.length; i < len; i++){
            var lnum = parseInt(err.stack[i].$line_info.split(",")[0]),
                line = lines[lnum - 1]
            $M.display("line " + lnum)
            $M.display("    " + line)
        }
    }
    throw err
}

var UndefinedType = {}

$M.get_class = function(obj){
    switch(typeof obj) {
        case "undefined":
            return UndefinedType
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
            }else if(obj instanceof Table){
                return "struct"
            }else if(obj instanceof Slice){
                return "slice"
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
    return $M.get_class(obj)
}

$M.call = function(obj){
    if(typeof obj == 'function'){
        return obj
    }else if(obj instanceof Table){
        return function(){
            var res = new Table()
            res.items = obj.items.slice()
            var i = 0
            for(var key in obj.keywords){
                var arg = arguments[i]
                if(arg !== undefined){
                    res.keywords[key] = arg
                }else{
                    res.keywords[key] = obj.keywords[key]
                }
                i++
            }
            res.table = obj
            return res
        }
    }
    throw $M.Error($M.get_class(obj) + ' is not callable')
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
        }else if(x instanceof Table && y instanceof Table){
            if(! $M.compare.eq(x.items, y.items)){
                return false
            }
            if(Object.keys(x.keywords).length != Object.keys(y.keywords).length){
                return false
            }
            for(let key in x.keywords){
                if(! y.keywords.hasOwnProperty(key)){
                    return false
                }
                if(! $M.compare.eq(x.keywords[key]), y.keywords[key]){
                    return false
                }
            }
            return true
        }else if(x === undefined || y === undefined){
            return x === undefined && y === undefined
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
    }else if(obj instanceof Table){
        var res = obj.keywords[key]
        if(res !== undefined){
            if(typeof res == 'function'){
                return function(){
                    return res(obj, ...arguments)
                }
            }
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
    if(obj instanceof Table){
        obj.keywords[key] = value
    }else{
        obj[key] = value
    }
}

$M.getitem = function(obj, key){
    var res
    if(obj instanceof Table){
        if(typeof key == "number"){
            if(key < 0){
                key = key + obj.items.length
            }
            res = obj.items[key]
        }else if(typeof key == "string"){
            if(key.match(/^\d+/)){
                res = obj.items[key]
            }else{
                res = obj.keywords[key]
            }
        }else if(key instanceof Array){
            // slice
            slice_to_index(key, obj.items)
            return $M.table(obj.items.slice(key[0], key[1]))
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
        }else if($M.get_class(key) == "int"){
            if(key < 0){
                key += obj.length
            }
            if(obj[key] !== undefined){
                return obj[key]
            }
            throw $M.Error("unknown key: " + key)
        }else if(key instanceof Array){
            slice_to_index(key, obj)
            return obj.substring(key[0], key[1])
        }
        throw $M.Error("unknown key: " + key)
    }
}

$M.is_member = function(item, obj){
    if(obj instanceof Table){
        return (obj.items.includes(item) ||
                obj.keywords.hasOwnProperty(item))
    }else if(typeof obj == 'string'){
        return obj.includes(item)
    }
    throw $M.Error('cant test membership of ' + $M.class_name(obj))
}

$M.setitem = function(obj, key, value){
    if(obj instanceof Table || obj.$is_struct_instance){
        if(typeof key == "number"){
            obj.items[key] = value
            return
        }else if(typeof key == "string"){
            obj.keywords[key] = value
            return
        }else if(key instanceof Array){
            // remove slice, replace it by value
            slice_to_index(key, obj.items)
            obj.items.splice(key[0], key[1] - key[0])
            for(var i = value.length - 1; i >= 0; i--){
                obj.items.splice(key[0], 0, value[i])
            }
            return
        }else{
            throw $M.Error("invalid key type: " + $M.get_class(key))
        }
    }
    throw $M.Error("cannot set item to " + $M.get_class(obj))
}

$M.augm_assign = function(sign, left, right){
    if(sign == '+='){
        if(left instanceof Table){
            if(right instanceof Table){
                for(item of right.items){
                    left.items.push(item)
                }
                for(key in right.keywords){
                    left.keywords[key] = right.keywords[key]
                }
                return left
            }
            throw $M.Error(`cannot add ${$M.get_class(right)} to table`)
        }else if(typeof left == 'number' || typeof left == 'string'){
            if(typeof right == 'number' || typeof right == 'string'){
                return left + right
            }
            throw $M.Error(`cannot add ${$M.get_class(right)} to number`)
        }
    }else{
        if(typeof left == 'number'){
            if(typeof right == 'number'){
                switch(sign){
                    case '+=':
                        return left + right
                    case '-=':
                        return left - right
                    case '*=':
                        return left * right
                    case '/=':
                        return left / right
                }
            }
            throw $M.Error(`${sign} not supported between ${$M.get_class(right)} and number`)
        }else if(typeof left == 'string'){
            if(typeof right == 'string' || typeof right == 'number'){
                switch(sign){
                    case '+=':
                        console.log('augm assign returns', left + right)
                        return left + right
                    case '-=':
                        return left - right
                    case '*=':
                        return left * right
                    case '/=':
                        return left / right
                }
            }
        }
    }
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
        }else if(typeof x == 'string' && typeof y == 'number'){
            return x + y // coerce number to string
        }else if(typeof x == 'number' && typeof y == 'string'){
            return x + y // idem
        }else if(Array.isArray(x) && Array.isArray(y)){
            return x.slice().concat(y)
        }else if(x instanceof Table){
            if(y instanceof Slice){
                if(y.stop === Number.POSITIVE_INFINITY){
                    throw $M.Error('cannot add infinite range')
                }
                var res = x.copy()
                for(var i = y.start; i < y.stop; i++){
                    res.items[res.items.length] = i
                }
                return res
            }else if(y instanceof Table){
                var res = x.copy()
                for(var item of y.items){
                    res.items.push(item)
                }
                for(var key in y.keywords){
                    res.keyswords[key] = y.keywords[key]
                }
                return res
            }
        }else if(x instanceof Slice){
            if(y.stop === Number.POSITIVE_INFINITY){
                throw $M.Error('cannot add infinite range')
            }
            return $M.operations.add(x.to_object(), y)
        }else{
            console.log('x', x, 'y', y)
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
    push: function(item, table){
        table.items.push(item)
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
    }else if(obj === undefined){
        return '?'
    }else if(is_number(obj)){
        return obj.toString()
    }else if(typeof obj == "string"){
        return "'" +
            obj.replace(/ /g, '\xa0').replace("'", "\\'") +
            "'"
    }else if(obj instanceof Array){
        var items = []
        for(const item of obj){
            items.push($M.str(item))
        }
        return '[' + items.join(', ') + ']'
    }else if(obj instanceof Table || obj.$is_struct_instance){
        var elts = []
        for(const item of obj.items){
            elts.push($M.repr(item))
        }
        for(var key in obj.keywords){
            elts.push(`${key}=${$M.repr(obj.keywords[key])}`)
        }
        res = obj instanceof Table ? '' : '<instance> '
        res += `[${elts.join(', ')}]`
        return res
    }else if(typeof obj == "function"){
        return 'function' + (obj.name ? ' ' + obj.name : '')
    }else{
        return '<unprintable>'
    }
}

$M.str = function(obj){
    if(typeof obj == "string"){
        return obj
    }else{
        return $M.repr(obj)
    }
}

var height = 18,
    pos = [0, height],
    svgns = 'http://www.w3.org/2000/svg'

$M.display = function(){
    var args
    if(arguments.length == 1 && Array.isArray(arguments[0])){
        args = arguments[0]
    }else{
        args = Array.from(arguments)
    }
    args = args.map($M.str)
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
    if(output.nodeName.toUpperCase() == "SVG"){
        while(output.firstChild){
            output.removeChild(output.firstChild)
        }
        console.log('cleared !')
        pos[0] = 0
        pos[1] = height
    }else if(output.nodeName == "TEXTAREA"){
        output.value = ""
    }
}

$M.search = function(name){
    var frame = $M.frames_stack[$M.frames_stack.length - 1],
        res = frame[name]
    if(res !== undefined){
        return res
    }
    throw $M.Error("Name error: " + name)
}

function Slice(start, stop){
    this.start = start
    this.stop = stop
}

Slice.prototype[Symbol.iterator] = function*(){
    for(var i = this.start; i < this.stop; i++){
      yield i
    }
}

Slice.prototype.to_object = function(){
    if(this.infinite){
        throw $M.error('cannot convert infinite range to object')
    }
    var res = new Table(),
        pos = 0
    for(var i = this.start; i < this.stop; i++){
        res.items[pos++] = i
    }
    return res
}

$M.range = function(start, stop){
    if(start === undefined){
        start = 0
    }
    if(stop === undefined){
        stop = Number.POSITIVE_INFINITY
        this.infinite = true
    }
    if(typeof start != "number"){
        throw $M.Error("start is not an integer")
    }
    if(typeof stop != "number"){
        throw $M.Error("stop is not an integer")
    }
    return new Slice(start, stop)
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

function Table(items, keywords){
    this.items = items ?? []
    this.keywords = keywords ?? {}
}

Table.prototype[Symbol.iterator] = function*(){
    var pos = 0
    for(var item of this.items){
        yield new Table([pos++, item])
    }
    for(var key in this.keywords){
        yield new Table([key, this.keywords[key]])
    }
}

Table.prototype.copy = function(){
    var res = new Table([], {})
    res.items = new Array(this.items.length)
    for(var i = 0, len = this.items.length; i < len; i++){
        res.items[i] = this.items[i]
    }
    for(var key in this.keywords){
        res.keywords[key] = this.keywords[key]
    }
    return res
}

$M.table = function(items, keywords){
    return new Table(items, keywords)
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

$M.make_iterator = function(obj){
    if(typeof obj == "number"){
        return new Slice(0, obj)[Symbol.iterator]()
    }else if(typeof obj == "string" || Array.isArray(obj)){
        return obj[Symbol.iterator]()
    }else if(obj instanceof Slice){
        return obj[Symbol.iterator]()
    }else if(obj instanceof Table){
        return obj[Symbol.iterator]()
    }
    throw $M.error('object is not iterable')
}

$M.unpack = function(obj){
    // same as make_iterable, except for Table
    if(obj instanceof Table){
        return obj.items[Symbol.iterator]()
    }
    return $M.make_iterator(obj)
}

})(__MINILANG__)
