// Python to Javascript translation engine

;(function($M){

Number.isInteger = Number.isInteger || function(value) {
  return typeof value === 'number' &&
    isFinite(value) &&
    Math.floor(value) === value
};

Number.isSafeInteger = Number.isSafeInteger || function (value) {
   return Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
};

var js,$pos,res,$op
var _b_ = $M.builtins
var _window
if ($M.isNode){
    _window={ location: {
        href:'',
        origin: '',
        pathname: ''} }
} else {
    _window=self
}

/*
Utility functions
=================
*/

// Return a clone of an object
var clone = $M.clone = function(obj){
    var res = {}
    for(var attr in obj){res[attr] = obj[attr]}
    return res
}

// Last element in a list
$M.last = function(table){return table[table.length - 1]}

// Convert a list to an object indexed with list values
$M.list2obj = function(list, value){
    var res = {},
        i = list.length
    if(value === undefined){value = true}
    while(i-- > 0){res[list[i]] = value}
    return res
}

/*
Internal variables
==================
*/

// Mapping between operators and special Python method names
$M.op2method = {
    operations: {
        "**": "pow", "//": "floordiv", "<<": "lshift", ">>": "rshift",
        "+": "add", "-": "sub", "*": "mul", "/": "truediv", "%": "mod"
    },
    binary: {
        "&": "and", "|": "or", "~": "invert", "^": "xor"
    },
    comparisons: {
        "<": "lt", ">": "gt", "<=": "le", ">=": "ge", "==": "eq", "!=": "ne",
        '<-': 'in'
    },
    boolean: {
        "||": "or", "&&": "and", "in": "in", "!": "not", "is": "is",
        "not_in": "not_in", "is_not": "is_not" // fake
    },
    subset: function(){
        var res = {},
            keys = []
        if(arguments[0] == "all"){
            keys = Object.keys($M.op2method)
            keys.splice(keys.indexOf("subset"), 1)
        }else{
            for(var i = 0, len=arguments.length; i < len; i++){
                keys.push(arguments[i])
            }
        }
        for(var i = 0, len = keys.length; i < len; i++){
            var key = keys[i],
                ops = $M.op2method[key]
            if(ops === undefined){throw Error(key)}
            for(var attr in ops){
                res[attr] = ops[attr]
            }
        }
        return res
    }
}

var $operators = $M.op2method.subset("all")

// Operators weight for precedence
var $op_order = [
    ['||'], ['&&'], ['!'],
    ['<-'],
    ['<', '<=', '>', '>=', '!=', '==', 'is', 'is_not'],
    ['|'],
    ['^'],
    ['&'],
    ['>>', '<<'],
    ['+'],
    ['-'],
    ['*', '/', '//', '%'],
    ['unary_neg', 'unary_pos'],
    ['**']
]

var $op_weight = {},
    $weight = 1
$op_order.forEach(function(_tmp){
    _tmp.forEach(function(item){
        $op_weight[item] = $weight
    })
    $weight++
})

var augmented_operators = ['+=', '-=', '*=', '/=']

// Variable used to generate random names used in loops
var $loop_num = 0


// Variable used for chained comparison
var chained_comp_num = 0

/*
Function called in case of SyntaxError
======================================
*/

var $_SyntaxError = function (context, msg, indent){
    //console.log("syntax error", context, "msg", msg, "indent", indent)
    var ctx_node = context
    while(ctx_node.type !== 'node'){ctx_node = ctx_node.parent}
    var tree_node = ctx_node.node,
        root = tree_node
    while(root.parent !== undefined){root = root.parent}
    var module = tree_node.module,
        src = root.src,
        line_num = tree_node.line_num
    if(src){
        line_num = src.substr(0, $pos).split("\n").length
    }
    if(root.line_info){
        line_num = root.line_info
    }
    if(indent !== undefined){line_num++}
    if(indent === undefined){
        if(Array.isArray(msg)){
            msg = msg[0]
        }
        var err = Error("SyntaxError")
        err.msg = msg
        err.type = "SyntaxError"
        err.line_num = line_num
        err.pos = $pos
        throw err
    }else{
        var err = Error("IndentationError")
        err.msg = msg
        err.type = "IndentationError"
        err.line_num = line_num
        err.pos = $pos
        throw err
    }
}


/*
Function that checks that a context is not inside another incompatible
context. Used for (augmented) assignements */
function check_assignment(context){
    var ctx = context,
        forbidden = ['assert', 'del', 'raise', 'exit']
    while(ctx){
        if(forbidden.indexOf(ctx.type) > -1){
            $_SyntaxError(context, 'invalid syntax - assign')
        }
        ctx = ctx.parent
    }
}

var $Node = function(type){
    this.type = type
    this.children = []

    this.add = function(child){
        // Insert as the last child
        this.children[this.children.length] = child
        child.parent = this
        child.module = this.module
    }

    this.insert = function(pos, child){
        // Insert child at position pos
        this.children.splice(pos, 0, child)
        child.parent = this
        child.module = this.module
    }

    this.toString = function(){return "<object 'Node'>"}

    this.show = function(indent){
        // For debugging purposes
        var res = ''
        if(this.type === 'module'){
            this.children.forEach(function(child){
                res += child.show(indent)
            })
            return res
        }

        indent = indent || 0
        res += ' '.repeat(indent)
        res += this.context
        if(this.children.length > 0){res += '{'}
        res +='\n'
        this.children.forEach(function(child){
           res += '[' + i + '] ' + child.show(indent + 4)
        })
        if(this.children.length > 0){
          res += ' '.repeat(indent)
          res += '}\n'
        }
        return res
    }

    this.to_js = function(indent){
        // Convert the node into a string with the translation in Javascript

        if(this.js !== undefined){return this.js}

        this.res = []
        this.unbound = []
        if(this.type === 'module'){
            this.children.forEach(function(child){
                this.res.push(child.to_js())
            }, this)
            this.js = this.res.join('')
            return this.js
        }
        indent = indent || 0
        if(this.context.block){
            console.log("node with bock", this)
        }
        var ctx_js = this.context.to_js()
        if(ctx_js){ // empty for "global x"
          this.res.push(' '.repeat(indent))
          this.res.push(ctx_js)
          if(this.children.length > 0){
              this.res.push("{")
          }
          this.res.push('\n')
          this.children.forEach(function(child){
              this.res.push(child.to_js(indent + 4))
          }, this)
          if(this.children.length > 0){
             this.res.push(' '.repeat(indent))
             this.res.push('}\n')
          }
        }
        this.js = this.res.join('')

        return this.js
    }

    this.transform = function(rank){
        // Apply transformations to each node recursively
        // Returns an offset : in case children were inserted by transform(),
        // we must jump to the next original node, skipping those that have
        // just been inserted

        if(this.type === 'module'){
            // module doc string
            this.$doc = $get_docstring(this)
            var i = 0
            while(i < this.children.length){
                var offset = this.children[i].transform(i)
                if(offset === undefined){offset = 1}
                i += offset
            }
        }else{
            var elt = this.context.tree[0], ctx_offset
            if(elt === undefined){
                console.log(this)
            }
            if(elt.transform !== undefined){
                ctx_offset = elt.transform(this, rank)
            }
            var i = 0
            while(i < this.children.length){
                var offset = this.children[i].transform(i)
                if(offset === undefined){offset = 1}
                i += offset
            }
            if(ctx_offset === undefined){ctx_offset = 1}

            return ctx_offset
        }
    }

    this.clone = function(){
        var res = new $Node(this.type)
        for(var attr in this){res[attr] = this[attr]}
        return res
    }

}

/*
Context classes
===============

In the parser, for each token found in the source code, a
new context is created by a call like :

    new_context = $transition(current_context, token_type, token_value)

For each new instruction, an instance of $Node is created ; it receives an
attribute "context" which is an initial, empty context.

For instance, if the first token is the keyword "def", the new_context
is an instance of class DefCtx, in a state where it expects an
indentifier.

Most contexts have an attribute "tree", a list of the elements associated
with the keyword or the syntax element (eg the arguments in a function
definition).

For contexts that need transforming the minilang instruction into several
Javascript instructions, a method transform(node, rank) is defined. It is
called by the method transform() on the root node (the top level instance of
$Node).

Most contexts have a method to_js() that return the Javascript code for
this context. It is called by the method to_js() of the root node.
*/

var AbstractExprCtx = function(context, with_commas){
    this.type = 'abstract_expr'
    // allow expression with comma-separated values, or a single value ?
    this.with_commas = with_commas
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this
}

AbstractExprCtx.prototype.toString = function(){
    return '(abstract_expr ) ' + this.tree
}

AbstractExprCtx.prototype.transition = function(token, value){
    var context = this,
        packed = context.packed,
        assign = context.parent.type == "assign"
    switch(token) {
        case 'id':
        case 'int':
        case 'float':
        case 'str':
        case '[':
        case '(':
            context.parent.tree.pop() // remove abstract expression
            var commas = context.with_commas
            context = context.parent
            if(assign){
                context.assign = assign
            }
    }

    switch(token) {
        case 'id':
            var expr = new ExprCtx(context, 'id', commas)
            return new IdCtx(expr, value)
        case 'str':
            return new StringCtx(new ExprCtx(context, 'str', commas),
                value)
        case 'int':
            return new IntCtx(new ExprCtx(context, 'int', commas),
                value)
        case 'float':
            return new FloatCtx(new ExprCtx(context, 'float', commas),
                value)
        case '(':
            return new ListOrTupleCtx(
                new ExprCtx(context, 'tuple', commas), 'tuple')
        case '[':
            return new AbstractExprCtx(new ObjectItemCtx(
                new ObjectCtx(new ExprCtx(context)), true))
        case 'loop':
        case '@':
        case '...':
            return new AbstractExprCtx(new LoopCtx(context), false)
        case 'op':
            var tg = value
            switch(tg) {
                case '-':
                case '+':
                    // create a left argument for operator "unary"
                    context.parent.tree.pop()
                    var left = new UnaryCtx(context.parent, tg)
                    // create the operator "unary"
                    if(tg == '-'){
                        var op_expr = new OpCtx(left,'unary_neg')
                    }else if(tg == '+'){
                        var op_expr = new OpCtx(left, 'unary_pos')
                    }
                    return new AbstractExprCtx(op_expr, false)
                case '!':
                    context.parent.tree.pop() // remove abstract expression
                    var commas = context.with_commas
                    context = context.parent
                    return new AbstractExprCtx(new NotCtx(context), false)
            }
            $_SyntaxError(context, 'token ' + token + ' after ' +
                context)
        case '=':
            $_SyntaxError(context, token)
        case ':':
            if(context.parent.type == "sub" ||
                    (context.parent.type == "list_or_tuple" &&
                    context.parent.parent.type == "sub")){
                return new AbstractExprCtx(new SliceCtx(context.parent), false)
            }
            return $transition(context.parent, token, value)
        case ')':
        case ',':
            switch(context.parent.type) {
                case 'slice':
                case 'list_or_tuple':
                case 'call_arg':
                case 'op':
                    break
                default:
                    $_SyntaxError(context, token)
            }
        case 'def':
            if(assign){
                // form "f = def(x, y)"
                var left = context.parent.tree[0]
                var node = context.parent.parent
                node.tree = []
                var defctx = new DefCtx(context.parent.parent)
                defctx.set_name(left)
                defctx.assigned = true
                return defctx
            }
    }
    return $transition(context.parent, token, value)
}

AbstractExprCtx.prototype.to_js = function(){
    this.js_processed = true
    if(this.type === 'list') return '[' + $to_js(this.tree) + ']'
    return $to_js(this.tree)
}


var AssignCtx = function(context, sign){
    /*
    Class for the assignment operator "="
    context is the left operand of assignment
    This check is done when the AssignCtx object is created, but must be
    disabled if a new AssignCtx object is created afterwards by method
    transform()
    */
    check_assignment(context)

    this.type = 'assign'
    this.sign = sign
    // replace parent by "this" in parent tree
    context.parent.tree.pop()
    context.parent.tree[context.parent.tree.length] = this

    this.parent = context.parent
    this.tree = [context]

    var scope = $get_scope(this)
    if(context.type == 'expr' && context.tree[0].type == 'call'){
        if(context.parent.type == 'node'){
            // function definition
            if(! ['id', 'attribute'].includes(context.tree[0].func.type)){
                console.log('not an id', context)
                $_SyntaxError(context, ['expected function name'])
            }
        }else{
            $_SyntaxError(context, ["can't assign to function call "])
        }
    }else{
        var assigned = context.tree[0]
        if(assigned && assigned.type == 'id'){
            // Attribute bound of an id indicates if it is being
            // bound, as it is the case in the left part of an assignment
            assigned.bound = true
            // A value is going to be assigned to a name
            // After assignment the name will be bound to the current
            // scope
            // We must keep track of the list of bound names before
            // this assignment, because in code like
            //
            //    range = range
            //
            // the right part of the assignement must be evaluated
            // first, and it is the builtin "range"
            var node = $get_node(this)
            node.bound_before = Object.keys(scope.binding)
            $bind(assigned.value, scope, this)
        }else if(["str", "int", "float"].indexOf(assigned.type) > -1){
            $_SyntaxError(context, ["can't assign to literal"])
        }else if(assigned.type == "unary"){
            $_SyntaxError(context, ["can't assign to operator"])
        }
    }
}

AssignCtx.prototype.transition = function(token, value){
    var context = this
    if(token == 'eol'){
        if(context.tree[1].type == 'abstract_expr'){
            if(context.tree[0].type == 'expr' &&
                    context.tree[0].tree[0].type == 'call'){
                var defctx = new DefCtx(context.tree[0].tree[0]),
                    defnode = $transition(defctx, token)
                return defnode
            }
            $_SyntaxError(context, 'token ' + token + ' after ' +
                context)
        }
        // If left is an id, update binding to the type of right operand
        return $transition(context.parent, 'eol')
    }
    $_SyntaxError(context, 'token ' + token + ' after ' + context)
}

AssignCtx.prototype.toString = function(){
    return '(assign) ' + this.tree[0] + '=' + this.tree[1]
}

AssignCtx.prototype.to_js = function(){
    this.js_processed = true

    // assignment
    var left = this.tree[0]
    while(left.type == 'expr'){
        left = left.tree[0]
    }
    var right = this.tree[1]
    if(left.type == 'attribute' || left.type == 'sub'){
        // In case of an assignment to an attribute or a subscript, we
        // use setattr() and setitem
        // If the right part is a call to exec or eval, it must be
        // evaluated and stored in a temporary variable, before
        // setting the attribute to this variable
        // This is because the code generated for exec() or eval()
        // can't be inserted as the third parameter of a function


        var right_js = right.to_js()
        if(left.type == 'attribute'){
            left.func = 'setattr'
            left.assign = right
            return left.to_js()
        }

        var res = '', rvar = '', $var = '$temp' + $loop_num
        if(right.type == 'expr' && right.tree[0] !== undefined &&
                right.tree[0].type == 'call' &&
                ('eval' == right.tree[0].func.value ||
                'exec' == right.tree[0].func.value)) {
            res += 'var ' + $var + ' = ' + right_js + ';\n'
            rvar = $var
        }else if(right.type == 'expr' && right.tree[0] !== undefined &&
                right.tree[0].type == 'sub'){
            res += 'var ' + $var + ' = ' + right_js + ';\n'
            rvar = $var
        }else{
            rvar = right_js
        }

        if(left.type == 'attribute'){ // assign to attribute
          $loop_num++
          left.func = 'setattr'
          var left_to_js = left.to_js()
          left.func = 'getattr'
          if(left.assign_self){
            return res + left_to_js[0] + rvar + left_to_js[1] + rvar + ')'
          }
          res += left_to_js
          res = res.substr(0, res.length - 1) // remove trailing )
          return res + ',' + rvar + ');'
        }
        if(left.type == 'sub'){ // assign to item

          return '$M.setitem(' + left.value.to_js() +
                  ',' + left.tree[0].to_js() + ',' + right_js + ')'
        }
    }
    var left_js = left.to_js(),
        right_js = right.to_js()
    if(this.sign == '='){
        return `var ${left_js} = ${right_js}`
    }else{
        return `${left_js} = $M.augm_assign("${this.sign[0]}", ${left_js}, ${right_js})`
    }
}

var AttrCtx = function(context){
    // Class for object attributes (eg x in obj.x)
    this.type = 'attribute'
    this.value = context.tree[0]
    this.parent = context
    context.tree.pop()
    context.tree[context.tree.length] = this
    this.tree = []
    this.func = 'getattr' // becomes setattr for an assignment
}

AttrCtx.prototype.transition = function(token, value){
    var context = this
    if(token === 'id'){
        context.name = value
        return context.parent
    }else if(kwdict.indexOf(token) > -1){
        context.name = token
        return context.parent
    }
    $_SyntaxError(context,token)
}

AttrCtx.prototype.to_js = function(){
    this.js_processed = true
    var js = this.value.to_js()
    if(this.func == 'setattr'){
        // For setattr, use $B.$setattr which doesn't use $B.args to parse
        // the arguments
        return `$M.setattr(${js}, '${this.name}', ${this.assign.to_js()})`
    }else{
        return '$M.getattr(' + js + ',"' + this.name + '")'
    }
}

var CallArgCtx = function(context){
    // Base class for arguments in a function call
    this.type = 'call_arg'
    this.parent = context
    this.start = $pos
    this.tree = []
    context.tree.push(this)
    this.expect = 'id'

    this.transition = function(token, value){
        var context = this
        switch(token) {
            case 'id':
            case 'int':
            case 'float':
            case 'str':
            case '[':
            case '(':
            case '.':
            case 'not':
                if(context.expect == 'id'){
                     context.expect = ','
                     var expr = new AbstractExprCtx(context, false)
                     return $transition(expr, token, value)
                }
                break
            case 'op':
                if(context.expect == 'id'){
                   var op = value
                   context.expect = ','
                   switch(op) {
                       case '+':
                       case '-':
                           return $transition(new AbstractExprCtx(context,false),token,op)
                   }
                }
                $_SyntaxError(context, 'token ' + token + ' after ' + context)
            case ')':
                if(context.parent.kwargs &&
                        $M.last(context.parent.tree).tree[0] && // if call ends with ,)
                        ['kwarg', 'star_arg', 'double_star_arg'].
                            indexOf($M.last(context.parent.tree).tree[0].type) == -1){
                    $_SyntaxError(context,
                        ['non-keyword arg after keyword arg'])
                }
                if(context.tree.length > 0){
                    var son = context.tree[context.tree.length - 1]
                    if(son.type == 'list_or_tuple' &&
                            son.real == 'gen_expr'){
                        son.intervals.push($pos)
                    }
                }
                return $transition(context.parent,token)
            case ':':
                if(context.expect == ',' &&
                        context.parent.parent.type == 'lambda') {
                    return $transition(context.parent.parent, token)
                }
                break
            case ',':
                if(context.expect == ','){
                    if(context.parent.kwargs &&
                            ['kwarg','star_arg', 'double_star_arg'].
                                indexOf($M.last(context.parent.tree).tree[0].type) == -1){
                        $_SyntaxError(context,
                            ['non-keyword arg after keyword arg'])
                    }
                    return $transition(context.parent, token, value)
                }
            case 'eol':
                if(context.parent.parent.type == "struct"){
                    return $transition(context.parent.parent, token, value)
                }

        }
        $_SyntaxError(context, 'token ' + token + ' after ' + context)
    }

    this.toString = function(){return 'call_arg ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var CallCtx = function(context){
    // Context of a call on a callable, ie what is inside the parenthesis
    // in "callable(...)"
    this.type = 'call'
    this.func = context.tree[0]
    if(this.func !== undefined){ // undefined for lambda
        this.func.parent = this
    }
    this.parent = context

    context.tree.pop()
    context.tree[context.tree.length] = this

    this.expect = 'id'
    this.tree = []
    this.start = $pos

    this.transition = function(token, value){
        var context = this
        switch(token) {
            case ',':
                if(context.expect == 'id'){$_SyntaxError(context, token)}
                context.expect = 'id'
                return context
            case 'id':
            case 'int':
            case 'float':
            case 'str':
            case '[':
            case '(':
            case '.':
            case 'not':
                context.expect = ','
                return $transition(new CallArgCtx(context), token,
                    value)
            case ')':
                context.end = $pos
                return context.parent
            case 'op':
                context.expect = ','
                switch(value) {
                    case '-':
                    case '+':
                        context.expect = ','
                        return $transition(new CallArgCtx(context), token,
                            value)
                }
                $_SyntaxError(context, token)
        }

        return $transition(context.parent, token, value)
    }

    this.toString = function(){
        return '(call) ' + this.func + '(' + this.tree + ')'
    }

    this.to_js = function(){
        var positional = [],
            star = [],
            dstar = [],
            keywords = []
        for(var i = 0, len = this.tree.length; i < len; i++){
            var arg = this.tree[i]
            positional.push(arg.tree[0].to_js())
        }
        return '$M.call(' + this.func.to_js() + ")(" +
            positional.join(", ") + ')'
    }
}


var ConditionCtx = function(context,token){
    // Class for keywords "if", "elif", "while"
    this.type = 'condition'
    this.token = token
    this.parent = context
    this.tree = []
    if(token == 'while'){this.loop_num = $loop_num++}
    context.tree[context.tree.length] = this

    this.transition = function(token, value){
        var context = this
        if(token == 'eol'){
            if(context.tree[0].type == "abstract_expr" &&
                    context.tree[0].tree.length == 0){ // issue #965
                $_SyntaxError(context, 'token ' + token + ' after ' + context)
            }
            return context.parent
        }
        $_SyntaxError(context, 'unexpected token ' + token)
    }

    this.toString = function(){return this.token + ' ' + this.tree}

    this.transform = function(node, rank){
        var scope = $get_scope(this)
        if(this.token == "while"){
            node.parent.insert(rank,
                NodeJS('locals["$no_break' + this.loop_num + '"] = true'))
            // because a node was inserted, return 2 to avoid infinite loop
            return 2
        }
    }
    this.to_js = function(){
        this.js_processed = true
        var tok = this.token
        if(tok == 'elif'){
            tok = 'else if'
        }
        // In a "while" loop, the flag "$no_break" is initially set to false.
        // If the loop exits with a "break" this flag will be set to "true",
        // so that an optional "else" clause will not be run.
        var res = [tok + '(']
        if(tok == 'else if'){
            var line_info = $get_node(this).line_num + ',' +
                $get_scope(this).id
            res.push('(locals.$line_info = "' + line_info + '") && ')
        }
        if(this.tree.length == 1){
            res.push($to_js(this.tree) + ')')
        }else{ // syntax "if cond : do_something" in the same line
            res.push(this.tree[0].to_js() + ')')
            if(this.tree[1].tree.length > 0){
                res.push('{' + this.tree[1].to_js() + '}')
            }
        }
        return res.join('')
    }
}

var DefCtx = function(context){
    this.type = 'def'
    this.func = context.func
    this.parent = context.parent.parent
    this.parent.tree = [this]
    this.parent.node.binding = {}

    this.args = []
    for(var arg of context.tree){
        var param = arg.tree[0].tree[0].value
        this.args.push(param)
        this.parent.node.binding[param] = true
    }

    this.locals = []

    // store id of enclosing functions
    this.enclosing = []
    var node = context.parent,
        scope = this.scope = $get_scope(this)
    // initialize object for names bound in the function
    node.binding = {}

    if(context.func instanceof IdCtx){
        $bind(context.func.value, scope, this)
    }

    var parent_block = scope
    this.parent.node.parent_block = parent_block

    this.module = scope.module
    this.root = $get_module(this)

    // num used if several functions have the same name
    this.num = $loop_num
    $loop_num++

}

DefCtx.prototype.transition = function(token, value){
    var context = this
    switch(token){
        case 'eol':
            return context.parent
    }
    $_SyntaxError(context, 'unexpected token ' + token)
}

DefCtx.prototype.to_js = function(){
    var js,
        node = $get_node(this)
    if(this.func instanceof IdCtx){
        js = `var ${this.func.value} = function(${this.args}){`
    }else if(this.func instanceof AttrCtx){
        js = `$M.setattr(${this.func.value.to_js()}, '${this.func.name}', function(${this.args}){`
    }
    for(var child of node.children){
        js += child.to_js()
    }
    node.children.length = 0
    js += '}'
    if(this.func instanceof AttrCtx){
        js += ')'
    }
    return js
}

DefCtx.prototype.transform = function(node, rank){
    // already transformed ?
    if(this.transformed !== undefined){return}

    var scope = this.scope

    // search doc string
    this.rank = rank

    // block indentation
    var indent = node.indent + 12

    var pnode = this.parent.node
    while(pnode.parent && pnode.parent.is_def_func){
        this.enclosing.push(pnode.parent.parent)
        pnode = pnode.parent.parent
    }

    var name
    if(this.func instanceof IdCtx){
        name = this.func.value
    }else if(this.func instanceof AttrCtx){
        name = this.func.name
    }
    node.children.splice(0, 0, NodeJS(`$M.frames_stack.push(locals_${name})`))
    node.children.splice(0, 0, NodeJS(`var locals_${name} = {${this.args}}`))
}


var ExitCtx = function(context){
    // Class for keyword "exit"
    this.type = 'exit'
    this.parent = context
    this.tree = []
    context.tree.push(this)

    // Check if inside a function or loop
    var node = $get_node(this)
    while(node){
        if(node.context && node.context.tree && node.context.tree[0]){
            var type = node.context.tree[0].type
            if(type == "module"){
                $_SyntaxError(context, "exit outside of def or loop")
            }else if(type == "loop" || type == "def"){
                this.block_type = type
                this.block_node = node
                break
            }
        }
        node = node.parent
    }
    if(node === undefined){
        this.block_type = "module"
    }

    this.transition = function(token, value){
        var context = this
        if(token == "if"){
            return new AbstractExprCtx(this, false)
        }else if(token == "eol"){
            if(this.tree.length == 2){
                this.condition = this.tree.pop()
            }
            if(this.block_type == "def" &&
                    this.tree[0].type == "abstract_expr"){
                // "exit" without a value is illegal in a function
                $_SyntaxError(context, "exit without value in def")
            }else if(this.block_type == "loop" &&
                    this.tree[0].type != "abstract_expr"){
                // "exit" with a value in a loop is valid if the loop is
                // inside a function
                var parent = this.block_node
                while(parent){
                    if(parent.context && parent.context.tree &&
                            parent.context.tree[0].type == "def"){
                        this.block_type = "def"
                        break
                    }
                    parent = parent.parent
                }
                if(! parent){
                    $_SyntaxError(context, "exit with value not in a def")
                }
            }
        }
        return $transition(context.parent, token, value)
    }

    this.toString = function(){return 'return ' + this.tree}

    this.transform = function(node, rank){
        if(this.condition){
            // form "exit if"
            var new_node = new $Node(),
                ctx = new NodeCtx(new_node),
                cond = new ConditionCtx(ctx, "if")
            cond.tree.push(this.condition)
            cond.tree[0].parent = cond
            node_parent = node.parent
            new_node.add(node)
            node_parent.children.splice(rank, 1)
            node_parent.insert(rank, new_node)
        }
    }

    this.to_js = function(){
        var js
        if(this.block_type == "def"){
            js = $to_js(this.tree)
            var js = 'var res = ' + js + ';' + '$M.leave_frame'
            js += '();return res'
        }else if(this.block_type == "loop"){
            // break a loop
            js = 'break'
        }else{
            console.log(this)
            if(this.tree[0].type == "abstract_expr"){
                js = 'throw $M.Error("Error: exit")'
            }else{
                js = 'throw $M.Error("Error: " + $M.str(' +
                    this.tree[0].to_js() + '))'
            }
        }
        return js
    }
}


var ExprCtx = function(context, name, with_commas){
    // Base class for expressions
    this.type = 'expr'
    this.name = name
    // allow expression with comma-separted values, or a single value ?
    this.with_commas = with_commas
    this.expect = ',' // can be 'expr' or ','
    this.parent = context
    if(context.packed){
        this.packed = context.packed
    }
    if(context.is_await){
        this.is_await = context.is_await
    }
    if(context.assign){
        // assignment expression
        this.assign = context.assign
    }
    this.tree = []
    context.tree[context.tree.length] = this

    this.transition = function(token, value){
        var context = this
        switch(token) {
            case 'int':
                // subscription
                var sub = new SubCtx(context),
                    ae = new AbstractExprCtx(sub)
                var x1 = $transition(ae, token, value),
                    x2 = $transition(x1, ']')
                return x2
            case 'float':
            case 'id':
            case 'int':
            case 'str':
                $_SyntaxError(context, 'token ' + token + ' after ' +
                    context)
                break
            case '[':
            case '(':
            case 'if':
                if(context.expect == 'expr'){
                    context.expect = ','
                    return $transition(new AbstractExprCtx(context, false),
                        token, value)
                }
        }
        switch(token) {
            case 'not':
                if(context.expect == ','){return new ExprNot(context)}
                break
            case '.':
                return new AttrCtx(context)
          case '[':
              return new AbstractExprCtx(new SubCtx(context), true)
          case '(':
              return new CallCtx(context)
          case '?':
              // go to upper expression
              var expr = context,
                  ctx = context.parent
              while(ctx){
                  if(ctx.type == 'expr'){
                      expr = ctx
                  }
                  ctx = ctx.parent
              }
              return new IfCtx(expr)
          case '->':
              if(context.parent instanceof LoopCtx){
                  return $transition(context.parent, token, value)
              }

          case 'op':
              // handle operator precedence ; fasten seat belt ;-)
              var op_parent = context.parent,
                  op = value

              var op1 = context.parent,
                  repl = null
              while(1){
                  if(op1.type == 'expr'){op1 = op1.parent}
                  else if(op1.type == 'op' &&
                          $op_weight[op1.op] >= $op_weight[op] &&
                          !(op1.op == '**' && op == '**')){ // cf. issue #250
                      repl = op1
                      op1 = op1.parent
                  }else if(op1.type == "not" &&
                          $op_weight['not'] > $op_weight[op]){
                      repl = op1
                      op1 = op1.parent
                  }else{break}
              }
              if(repl === null){
                  while(1){
                      if(context.parent !== op1){
                          context = context.parent
                          op_parent = context.parent
                      }else{
                          break
                      }
                  }
                  context.parent.tree.pop()
                  var expr = new ExprCtx(op_parent, 'operand',
                      context.with_commas)
                  expr.expect = ','
                  context.parent = expr
                  var new_op = new OpCtx(context, op)
                  return new AbstractExprCtx(new_op, false)
              }else{
                  // issue #371
                  if(op === '&&' || op === '||'){
                      while(repl.parent.type == 'not'||
                              (repl.parent.type == 'expr' &&
                              repl.parent.parent.type == 'not')){
                          // 'and' and 'or' have higher precedence than 'not'
                          repl = repl.parent
                          op_parent = repl.parent
                      }
                  }
              }
              if(repl.type == 'op'){
                  var _flag = false
                  switch(repl.op){
                      case '<':
                      case '<=':
                      case '==':
                      case '!=':
                      case '>=':
                      case '>':
                         _flag = true
                  }
                  if(_flag) {
                      switch(op) {
                          case '<':
                          case '<=':
                          case '==':
                          case '!=':
                          case '>=':
                          case '>':
                           // chained comparisons such as c1 <= c2 < c3
                           // replace by (c1 op1 c2) and (c2 op c3)

                           // save c2
                           var c2 = repl.tree[1], // right operand of op1
                               c2js = c2.to_js()

                           // clone c2
                           var c2_clone = new Object()
                           for(var attr in c2){c2_clone[attr] = c2[attr]}

                           // The variable c2 must be evaluated only once ;
                           // we generate a temporary variable name to
                           // replace c2.to_js() and c2_clone.to_js()
                           var vname = "$c" + chained_comp_num
                           c2.to_js = function(){return vname}
                           c2_clone.to_js = function(){return vname}
                           chained_comp_num++

                           // If there are consecutive chained comparisons
                           // we must go up to the uppermost 'and' operator
                           while(repl.parent && repl.parent.type == 'op'){
                               if($op_weight[repl.parent.op] <
                                       $op_weight[repl.op]){
                                   repl = repl.parent
                               }else{break}
                           }
                           repl.parent.tree.pop()

                           // Create a new 'and' operator, with the left
                           // operand equal to c1 <= c2
                           var and_expr = new OpCtx(repl, '&&')
                           // Set an attribute "wrap" to the OpCtx instance.
                           // It will be used in an anomymous function where
                           // the temporary variable called vname will be
                           // set to the value of c2
                           and_expr.wrap = {'name': vname, 'js': c2js}

                           c2_clone.parent = and_expr
                           // For compatibility with the interface of OpCtx,
                           // add a fake element to and_expr : it will be
                           // removed when new_op is created at the next
                           // line
                           and_expr.tree.push('xxx')
                           var new_op = new OpCtx(c2_clone, op)
                           return new AbstractExprCtx(new_op, false)
                     }
                  }
              }
              repl.parent.tree.pop()
              var expr = new ExprCtx(repl.parent,'operand',false)
              expr.tree = [op1]
              repl.parent = expr
              var new_op = new OpCtx(repl,op) // replace old operation
              return new AbstractExprCtx(new_op,false)
          case ":":
              // slice only if expr parent is a subscription, or a tuple
              // inside a subscription, or a slice
              if(context.parent.type == "sub" ||
                      (context.parent.type == "list_or_tuple" &&
                      context.parent.parent.type == "sub")){
                  return new AbstractExprCtx(new SliceCtx(context.parent),
                      false)
              }else if(context.parent.type == "slice"){
                  return $transition(context.parent, token, value)
              }else if(context.parent.type == "assign" &&
                      context.name == "id" &&
                      context === context.parent.tree[1]){
                  // syntax "Position = x:5, y:6"
                  return new AbstractExprCtx(new StructCtx(context), false)
              }
              break
          case '=':
          case '+=':
          case '-=':
          case '*=':
          case '/=':
              function has_parent(ctx, type){
                  // Tests if one of ctx parents is of specified type
                  while(ctx.parent){
                      if(ctx.parent.type == type){return ctx.parent}
                      ctx = ctx.parent
                  }
                  return false
              }
              if(context.expect == ','){
                 if(context.parent.type == "op"){
                      // issue 811
                      $_SyntaxError(context, ["can't assign to operator"])
                 }
                 if(context.parent && context.parent.type == "object_item"){
                     if(context.parent.tree.length == 1){
                         // form [a=0]
                         if(context.parent.tree[0].type !== "expr" ||
                                 ["id", "str"].indexOf(context.parent.tree[0].name) == -1){
                             console.log(context.parent.tree[0])
                             $_SyntaxError(context, 'object key is not an id or string')
                         }
                         return new AbstractExprCtx(context.parent, false)
                     }else{
                         $_SyntaxError(context, 'token ' + token + ' after '
                             + context)
                     }
                 }
                 while(context.parent !== undefined){
                     context = context.parent
                     if(context.type == "condition"){
                         $_SyntaxError(context, 'token ' + token + ' after '
                             + context)
                     }
                 }
                 context = context.tree[0]
                 if(context.type == "assign"){
                     $_SyntaxError(context, "consecutive assignements")
                 }
                 return new AbstractExprCtx(new AssignCtx(context, token), true)
              }
              break
        }
        return $transition(context.parent,token)
    }

    this.toString = function(){
        return '(expr ' + with_commas + ') ' + this.tree
    }

    this.to_js = function(arg){
        var res
        this.js_processed = true
        if(this.type == 'list'){res = '[' + $to_js(this.tree) + ']'}
        else if(this.tree.length == 1){res = this.tree[0].to_js(arg)}
        else{res = '_b_.tuple.$factory([' + $to_js(this.tree) + '])'}

        return res
    }
}

var FloatCtx = function(context,value){
    // Class for literal floats
    this.type = 'float'
    this.value = value
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.transition = function(token, value){
        var context = this
        switch(token) {
            case 'id':
            case 'int':
            case 'float':
            case 'str':
            case '[':
            case '(':
            case 'not':
                $_SyntaxError(context, 'token ' + token + ' after ' +
                    context)
        }
        return $transition(context.parent, token, value)
    }

    this.toString = function(){return 'float ' + this.value}

    this.to_js = function(){
        this.js_processed = true
        // number literal
        if(/^\d+$/.exec(this.value) ||
            /^\d+\.\d*$/.exec(this.value)){
                return '(new Number(' + this.value + '))'
        }

        return 'float.$factory(' + this.value + ')'
    }
}


var FuncArgsCtx = function(context){
    // Class for arguments in a function definition
    this.type = 'func_args'
    this.parent = context
    this.tree = []
    this.names = []
    context.tree[context.tree.length] = this

    this.expect = 'id'

    this.transition = function(token, value){
        var context = this
        switch (token) {
            case 'id':
                if(context.expect == 'id'){
                    context.expect = ','
                    if(context.names.indexOf(value) > -1){
                      $_SyntaxError(context,
                          ['duplicate argument ' + value +
                              ' in function definition'])
                    }
                }
                return new FuncArgIdCtx(context, value)
            case ',':
                if(context.expect == ','){
                    context.expect = 'id'
                    return context
                }
                $_SyntaxError(context, 'token ' + token + ' after ' +
                    context)
            case ')':
                return context.parent
        }
        $_SyntaxError(context, 'token ' + token + ' after ' + context)
    }

    this.toString = function(){return 'func args ' + this.tree}

    this.to_js = function(){
        this.js_processed = true
        return $to_js(this.tree)
    }
}

var FuncArgIdCtx = function(context,name){
    // id in function arguments
    // may be followed by = for default value
    this.type = 'func_arg_id'
    this.name = name
    this.parent = context

    context.parent.positional_list.push(name)

    // bind name to function scope
    var node = $get_node(this)
    if(node.binding[this.name]){
        $_SyntaxError(context,
            ["duplicate argument '" + name + "' in function definition"])
    }
    $bind(this.name, node, this)

    this.tree = []
    context.tree[context.tree.length] = this
    // add to locals of function
    var ctx = context
    while(ctx.parent !== undefined){
        if(ctx.type == 'def'){
            ctx.locals.push(name)
            break
        }
        ctx = ctx.parent
    }

    this.expect = '='

    this.transition = function(token, value){
        var context = this
        switch(token) {
            case ',':
            case ')':
                return $transition(context.parent, token)
        }
        $_SyntaxError(context, 'token ' + token + ' after ' + context)
    }

    this.toString = function(){
        return 'func arg id ' + this.name + '=' + this.tree
    }

    this.to_js = function(){
        this.js_processed = true
        return this.name + $to_js(this.tree)
    }
}

var IdCtx = function(context, value){
    // Class for identifiers (variable names)

    this.type = 'id'
    this.value = value
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    var scope = this.scope = $get_scope(this)
    this.blurred_scope = this.scope.blurred
    this.env = clone(this.scope.binding)

    // Store variables referenced in scope
    if(scope.ntype == "def"){
        scope.referenced = scope.referenced || {}
        if(! $M.builtins[this.value]){
            scope.referenced[this.value] = true
        }
    }
    if(context.parent.type == 'call_arg') {
        this.call_arg = true
    }

    var ctx = context
    while(ctx.parent !== undefined){
        switch(ctx.type) {
          case 'list_or_tuple':
          case 'call_arg':
          case 'def':
            if(ctx.vars === undefined){ctx.vars = [value]}
            else if(ctx.vars.indexOf(value) == -1){ctx.vars.push(value)}
            if(this.call_arg&&ctx.type == 'lambda'){
                if(ctx.locals === undefined){ctx.locals = [value]}
                else{ctx.locals.push(value)}
            }
        }
        ctx = ctx.parent
    }

    if(context.type == 'target_list' ||
            (context.type == 'expr' && context.parent.type == 'target_list')){
        // An id defined as a target in a "for" loop is bound in the scope,
        // but *not* in the node bindings, because if the iterable is empty
        // the name has no value (cf. issue 1233)
        this.no_bindings = true
        $bind(value, scope, this)
        this.bound = true
    }

    this.transition = function(token, value){
        var context = this
        switch(token) {
            case '=':
                if(context.parent.type == 'expr' &&
                        context.parent.parent !== undefined &&
                        context.parent.parent.type == 'call_arg'){
                    $_SyntaxError(context, ["illegal = in call argument"])
                }
                return $transition(context.parent, token, value)
            case 'op':
                return $transition(context.parent, token, value)
            case 'id':
            case 'str':
            case 'float':
                if(context.value == "print"){
                    $_SyntaxError(context,
                        ["missing parenthesis in call to 'print'"])
                }
                $_SyntaxError(context, 'token ' + token +
                    (value === undefined ? '' : ' (' + value +')') +
                    ' after ' + context)
        }

        return $transition(context.parent, token, value)
    }

    this.toString = function(){
        return 'id (' + this.value + (this.tree.length ? '):' + this.tree : ')')
    }

    this.firstBindingScopeId = function(){
        // Returns the id of the first scope where this.name is bound
        var scope = this.scope,
            found = [],
            nb = 0
        while(scope && nb++ < 20){
            if(scope.binding && scope.binding[this.value]){
                return scope.id
            }
            scope = scope.parent
        }
    }

    this.boundBefore = function(scope){
        // Returns true if we are sure that the id is bound in the scope,
        // because there is at least one binding when going up the code tree.
        // This is used to avoid checking that the name exists at run time.
        // Example:
        //
        // def f():
        //     if some_condition():
        //         x = 9
        //     print(x)
        //
        // For the second "x", this.boundBefore() will return false because
        // the binding "x = 9" is not in the lines found when going up the
        // code tree. It will be translated to $local_search("x"), which will
        // check at run time if the name "x" exists and if not, raise an
        // UnboundLocalError.
        var node = $get_node(this),
            found = false
        var $test = this.value == "bx"

        while(!found && node.parent){
            var pnode = node.parent
            if(pnode.bindings && pnode.bindings[this.value]){
                if($test){console.log("bound in", pnode)}
                return pnode.bindings[this.value]
            }
            for(var i = 0; i < pnode.children.length; i++){
                var child = pnode.children[i]
                if(child === node){break}
                if(child.bindings && child.bindings[this.value]){
                    if($test){console.log("bound in child", child)}
                    return child.bindings[this.value]
                }
            }
            if(pnode === scope){
                break
            }
            node = pnode
        }

        return found
    }

    this.bindingType = function(scope){
        // If a binding explicitely sets the type of a variable (eg "x = 1")
        // the next references can use this type if there is no block
        // inbetween.
        // For code like:
        //
        //     x = 1
        //     x += 2
        //
        // for the id "x" in the second line, this.bindingType will return
        // "int".
        //
        // A block might reset the type, like in
        //
        //     x = 1
        //     if True:
        //         x = "a"
        //     x += 2
        //
        // For the id "x" in the last line, this.bindingType will just return
        // "true"
        var nb = 0,
            node = $get_node(this),
            found = false,
            unknown,
            ix

        while(!found && node.parent && nb++ < 100){
            var pnode = node.parent
            if(pnode.bindings && pnode.bindings[this.value]){
                return pnode.bindings[this.value]
            }
            for(var i = 0; i < pnode.children.length; i++){
                var child = pnode.children[i]
                if(child === node){break}
                if(child.bindings && child.bindings[this.value]){
                    found = child.bindings[this.value]
                    ix = i
                }
            }
            if(found){
                for(var j = ix + 1; j < pnode.children.length; j++){
                    child = pnode.children[j]
                    if(child.children.length > 0){
                        unknown = true
                        break
                    }else if(child === node){
                        break
                    }
                }
                return unknown || found
            }
            if(pnode === scope){
                break
            }
            node = pnode
        }

        return found
    }

    this.to_js = function(arg){
        var value = this.value,
            scope = this.scope
        var test = false // value == "print"
        if(test){
            console.log("to js", this)
        }
        while(scope){
            if(test){
                console.log("search", value, "in", scope.id, scope.binding)
            }
            if(scope.binding.hasOwnProperty(value)){
                var is_defined = this.bound || this.boundBefore(scope)
                var js
                if(test){
                    console.log(value, "defined ?", is_defined)
                }
                if(scope.id === this.scope.id){
                    js = value
                }else if(scope.id == "__builtins__"){
                    return "_b_." + value
                }else{
                    js = value
                }
                if(is_defined){
                    return js
                }else if(this.augm_assign){
                    return js
                }else{
                    // If name is not bound in the instruction, or if it has
                    // not been bound in the previous instructions, check
                    // that the value is not undefined, otherwise raise a
                    // NameError
                    return js
                }
            }
            scope = scope.parent_block
        }
        return "$M.search('" + value + "')"
    }
}

function IfCtx(context){
    this.type = 'if'
    this.parent = context.parent
    var expr = context.parent.tree.pop()
    context.parent.tree.push(this)
    this.tree = [expr]
    expr.parent = this
}

IfCtx.prototype.transition = function(token, value){
    var context = this
    if(token == 'eol'){
        return this.parent
    }
    $_SyntaxError(context, 'if expects eol')
}

IfCtx.prototype.to_js = function(){
    return `if(${this.tree[0].to_js()})`
}

function ImportCtx(context){
    // Class for keyword "import"
    this.type = 'import'
    this.parent = context
    this.tree = []
    context.tree.push(this)

    this.transition = function(token, value){
        var context = this
        if(token == 'eol'){
            if(context.tree[0].type != "expr" &&
                    context.tree[0].name != "id"){
                $_SyntaxError("import not followed by module name")
            }
            this.modname = context.tree[0].tree[0].value
            console.log("scope", $get_scope(this))
            $bind(this.modname, $get_scope(this), context)
            return $transition(context.parent, token)
        }
        $_SyntaxError(context, "illegal token after import")
    }

    this.transform = function(node, rank){
    }

    this.to_js = function(){
        var js = 'var module = $M.imported["' + this.modname +
            '"]; if(module === undefined){throw $M.Error("no module ' +
            this.modname +'")};var ' + this.modname + ' = module'
        return js
    }
}

var InputCtx = function(context){
    this.type = 'input'
    this.tree = []
    this.parent = context
    context.tree[context.tree.length] = this
}

InputCtx.prototype.transition = function(token, value){
    return $transition(this.parent, token, value)
}

InputCtx.prototype.to_js = function(){
    if(this.tree[0] instanceof AbstractExprCtx){
        return 'prompt()'
    }else{
        var assigned = this.tree[0].tree[0],
            scope = $get_scope(this)
        switch(assigned.type){
            case 'id':
                $bind(assigned.value, scope, this)
                return 'var ' + assigned.value + ' = prompt()'
            case 'attribute':
                return `$M.setattr(${assigned.value.to_js()}, ` +
                    `'${assigned.name}', prompt())`
            case 'sub':
                return `$M.setitem(${assigned.value.to_js()}, ` +
                    `${assigned.tree[0].to_js()}, prompt())`
        }
        $_SyntaxError(context, 'token ' + token + ' after ' +
            context)
    }
}

var IntCtx = function(context,value){
    // Class for literal integers
    // value is a 2-elt tuple [base, value_as_string] where
    // base is one of 16 (hex literal), 8 (octal), 2 (binary) or 10 (int)
    this.type = 'int'
    this.value = value
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.transition = function(token, value){
        var context = this
        switch(token) {
            case 'id':
            case 'int':
            case 'float':
            case 'str':
            case '[':
            case '(':
            case 'not':
                $_SyntaxError(context, 'token ' + token + ' after ' +
                    context)
        }
        return $transition(context.parent, token, value)
    }

    this.toString = function(){return 'int ' + this.value}

    this.to_js = function(){
        this.js_processed = true
        var v = parseInt(value[1], value[0])
        if(v > $M.min_int && v < $M.max_int){return v}
        else{
            return '$M.long_int.$factory("' + value[1] + '", ' + value[0] + ')'
        }
    }
}

var $JSCode = function(js){
    this.js = js

    this.toString = function(){return this.js}

    this.to_js = function(){
        this.js_processed = true
        return this.js
    }
}


var ListOrTupleCtx = function(context,real){
    // Class for literal lists or tuples
    // The real type (list or tuple) is set inside $transition
    // as attribute 'real'
    this.type = 'list_or_tuple'
    this.start = $pos
    this.real = real
    this.expect = 'id'
    this.closed = false
    this.parent = context
    this.tree = []
    context.tree[context.tree.length] = this

    this.transition = function(token, value){
        var context = this
        if(context.closed){
            if(token == '['){
                return new AbstractExprCtx(
                    new SubCtx(context.parent),false)
            }
            if(token == '('){return new CallCtx(context.parent)}
            return $transition(context.parent, token, value)
        }else{
            if(context.expect == ','){
                switch(context.real){
                    case 'tuple':
                        if(token == ')'){
                            if(context.parent.type == "expr" &&
                                    context.parent.parent.type == "node" &&
                                    context.tree.length == 1){
                                // Not a tuple, just an expression inside
                                // parenthesis at node level : replace by
                                // the expression.
                                // Required for code like
                                //     (pars): bool = True
                                var node = context.parent.parent,
                                    ix = node.tree.indexOf(context.parent),
                                    expr = context.tree[0]
                                expr.parent = node
                                expr.$in_parens = true // keep information
                                node.tree.splice(ix, 1, expr)
                            }
                            context.closed = true
                            return context.parent
                        }
                        break
                    case 'list':
                        if(token == ']'){
                             context.closed = true
                             return context.parent
                        }else if(token == ":"){
                            // slice, eg [0:4]
                            // replace list
                            return new AbstractExprCtx(
                                new SliceCtx(context), "slice", false)
                        }
                        break
                }

                switch(token) {
                    case ',':
                        if(context.real == 'tuple'){
                            context.has_comma = true
                        }
                        context.expect = 'id'
                        return context
                }
                return $transition(context.parent,token,value)
            }else if(context.expect == 'id'){
                switch(context.real) {
                    case 'tuple':
                        if(token == ')'){
                          context.closed = true
                          return context.parent
                        }
                        break
                    case 'list':
                        if(token == ']'){
                          context.closed = true
                          return context
                        }
                        break
                }

                switch(token) {
                    case ')':
                    case ']':
                        break
                    case ',':
                        $_SyntaxError(context,
                            'unexpected comma inside list')
                    default:
                        context.expect = ','
                        var expr = new AbstractExprCtx(context, false)
                        return $transition(expr,token, value)
                }

            }else{
                return $transition(context.parent, token, value)
            }
        }
    }

    this.toString = function(){
        switch(this.real) {
          case 'list':
            return '(list) [' + this.tree + ']'
          default:
            return '(tuple) (' + this.tree + ')'
        }
    }

    this.bind_ids = function(scope){
        // Used by AssignCtx for assignments to a list or tuple
        // Binds all the "simple" ids (not the calls, subscriptions, etc.)
        this.tree.forEach(function(item){
            if(item.type == 'id'){
                $bind(item.value, scope, this)
                item.bound = true
            }else if(item.type == 'expr' && item.tree[0].type == "id"){
                $bind(item.tree[0].value, scope, this)
                item.tree[0].bound = true
            }else if(item.type == 'expr' && item.tree[0].type == "packed"){
                if(item.tree[0].tree[0].type == 'id'){
                    $bind(item.tree[0].tree[0].value, scope, this)
                    item.tree[0].tree[0].bound = true
                }
            }else if(item.type == 'list_or_tuple' ||
                    (item.type == "expr" &&
                        item.tree[0].type == 'list_or_tuple')){
                if(item.type == "expr"){item = item.tree[0]}
                item.bind_ids(scope)
            }
        }, this)
    }

    this.to_js = function(){
        this.js_processed = true

        switch(this.real) {
            case 'list':
                var args = []
                for(const item of this.tree){
                    args.push([item.to_js()])
                }
                console.log("args", args)
                return '[' + args.join(', ') + ']'
            case 'tuple':
                if(this.tree.length == 1 && this.has_comma === undefined){
                    return this.tree[0].to_js()
                }
                return $to_js(this.tree)
        }
    }
}

var LoopCtx = function(context){

    this.type = "loop"
    this.parent = context
    context.tree.push(this)
    this.tree = []

    this.transition = function(token, value){
        var context = this
        if(token == "eol"){
            if(this.tree.length > 0){
                // form "loop iterable"
                if(this.tree[0].type == "abstract_expr"){
                    // form "loop" without argument
                    this.tree.pop()
                    return $transition(context.parent, token, value)
                }else{
                    this.iterable = this.tree[0]
                }
                if(this.tree.length == 1){
                    this.varname = "_" + $loop_num
                    $loop_num++
                }else if(this.tree.length == 2){
                    if(this.tree[1].type != "expr" ||
                            this.tree[1].name != "id"){
                        $_SyntaxError(context, "simple identifier expected " +
                            "after :")
                    }
                    this.varname = this.tree[1].tree[0].value
                    var scope = $get_scope(this)
                    $bind(this.varname, scope, this)
                }else{
                    $_SyntaxError(context, "invalid syntax")
                }
            }
            return $transition(context.parent, token, value)
        }else if(token == ":" && this.tree.length == 1){
            return new AbstractExprCtx(this, false)
        }else if(token == '->' && this.tree.length == 1){
            return new AbstractExprCtx(this, false)

        }
        console.log(this, token, value)
        $_SyntaxError(context, 'unexpected token after loop')
    }

    this.transform = function(node, rank){
        if(this.tree.length == 2){
            // insert node to set value of varname inside the loop
            node.insert(0, NodeJS('locals.' + this.varname + ' = ' +
                this.varname))
        }
    }

    this.to_js = function(){
        if(this.tree.length == 0){
            return "while(true)"
        }else{
            return `for(let ${this.varname} of ` +
                     `$M.make_iterable(${this.tree[0].to_js()}))`
        }
    }
}

var NodeCtx = function(node){
    // Base class for the context in a node
    this.node = node
    node.context = this
    this.tree = []
    this.type = 'node'

    var scope = null
    var tree_node = node
    while(tree_node.parent && tree_node.parent.type != 'module'){
        var ntype = tree_node.parent.context.tree[0].type,
            _break_flag = false
        switch(ntype){
            case 'def':
                scope = tree_node.parent
                _break_flag = true
        }
        if(_break_flag){break}

        tree_node = tree_node.parent
    }
    if(scope === null){
        scope = tree_node.parent || tree_node // module
    }

    // When a new node is created, a copy of the names currently
    // bound in the scope is created. It is used in IdCtx to detect
    // names that are referenced but not yet bound in the scope
    this.node.locals = clone(scope.binding)
    this.scope = scope

    this.transition = function(token, value){
        var context = this
        switch(token) {
            case 'id':
            case 'int':
            case 'float':
            case 'str':
            case '[':
            case '(':
                var expr = new AbstractExprCtx(context, true)
                return $transition(expr, token, value)
            case '->':
                // exit
                return new AbstractExprCtx(new ExitCtx(context),true)
            case 'op':
                switch(value) {
                    case '*':
                    case '+':
                    case '-':
                    case '~':
                        var expr = new AbstractExprCtx(context, true)
                        return $transition(expr, token, value)
                    case '<<':
                        return new AbstractExprCtx(new InputCtx(context), true)
                    case '>>':
                        return new AbstractExprCtx(new OutputCtx(context), true)
                }
                break
            case 'def':
                return new DefCtx(context)
            case '...':
                return new AbstractExprCtx(new LoopCtx(context), false)
            case 'exit':
                return new AbstractExprCtx(new ExitCtx(context),true)
            case 'eol':
                if(context.tree.length == 0){ // might be the case after a :
                    context.node.parent.children.pop()
                    return context.node.parent.context
                }
                return context
            case 'import':
                return new AbstractExprCtx(new ImportCtx(context), false)
            case ':':
                if(context.tree.length == 1){
                    if(context.tree[0].type == 'expr' &&
                            context.tree[0].tree.length == 1 &&
                            context.tree[0].tree[0].type == 'call'){
                        return new DefCtx(context.tree[0].tree[0])
                    }
                }
                break
        }
        console.log('syntax error', 'token', token, 'after', context)
        $_SyntaxError(context, 'token ' + token + ' after ' + context)
    }

    this.toString = function(){return 'node ' + this.tree}

    this.to_js = function(){
        if(this.js !== undefined){return this.js}
        this.js_processed = true
        if(this.tree.length > 1){
            var new_node = new $Node()
            var ctx = new NodeCtx(new_node)
            ctx.tree = [this.tree[1]]
            new_node.indent = node.indent + 4
            this.tree.pop()
            node.add(new_node)
        }
        this.js = ""

        if(node.children.length == 0){
            this.js += $to_js(this.tree) + ';'
        }else{
            this.js += $to_js(this.tree)
        }
        return this.js
    }
}

var NodeJS = function(js){
    var node = new $Node()
    new NodeJSCtx(node, js)
    return node
}

var NodeJSCtx = function(node,js){
    // Class used for raw JS code
    this.node = node
    node.context = this
    this.type = 'node_js'
    this.tree = [js]

    this.toString = function(){return 'js ' + js}

    this.to_js = function(){
        this.js_processed = true
        return js
    }
}

var NotCtx = function(context){
    this.type = 'not'
    this.parent = context
    context.tree.push(this)
    this.tree = []
}

NotCtx.prototype.transition = function(token, value){
    return $transition(this.parent, token, value)
}


NotCtx.prototype.to_js = function(){
    return '! ' + $to_js(this.tree)
}

var ObjectCtx = function(context){

    this.type = "object"
    this.parent = context
    context.tree.push(this)
    this.tree = []
    this.has_kw = false

    this.transition = function(token, value){
        var context = this
        if(token == ","){
            if(context.is_slice){
                $_SyntaxError(context, "slice must be the only element inside []")
            }
            return new AbstractExprCtx(new ObjectItemCtx(context), false)
        }else if(token == "]"){
            this.closed = true
            return context.parent
        }else if(token == ":"){
            console.log("token : in object")
        }
        if(this.closed){
            return $transition(context.parent, token, value)
        }
        $_SyntaxError(context, 'unexpected token after object')
    }

    this.transform = function(node, rank){
        if(this.tree.length == 2){
            // insert node to set value of varname inside the loop
            node.insert(0, NodeJS('locals.' + this.varname + ' = ' +
                this.varname))
        }
    }

    this.to_js = function(){
        var items = [],
            kw_items = [],
            key
        for(const item of this.tree){
            if(item.type == "slice"){
                return item.to_js()
            }else if(item.tree.length == 1){
                items.push(item.to_js())
            }else{
                if(item.tree[0].type == "expr" &&
                        item.tree[0].name == "id"){
                    key = item.tree[0].tree[0].value
                }else{
                    key = item.tree[0].to_js()
                }
                kw_items.push(`${key}: ${item.tree[1].to_js()}`)
            }
        }
        return  `$M.table([${items.join(', ')}], {${kw_items.join(', ')}})`
    }
}

var ObjectItemCtx = function(context){

    this.type = "object_item"
    this.parent = context
    context.tree.push(this)
    this.tree = []

    this.transition = function(token, value){
        var context = this
        if(token == "," || token == "]"){
            if(context.tree.length == 2){
                context.parent.has_kw = true
            }else if(context.parent.has_kw && context.tree.length == 1){
                $_SyntaxError(context, 'non-keyword after keyword')
            }
            if(context.tree[0].type == "abstract_expr"){
                if(token == ","){
                    $_SyntaxError(context, "consecutive commas inside []")
                }else{
                    context.parent.tree.pop()
                }
            }
            return $transition(context.parent, token, value)
        }else if(token == "=" && this.tree.length == 1){
            return new AbstractExprCtx(context, false)
        }else if(token == ":"){
            if(context.parent.tree.length > 1){
                $_SyntaxError(context, "slice must be the only element inside []")
            }
            var slice = new SliceCtx(context.parent)
            context.parent.is_slice = true
            if(context.tree[0].type == "abstract_expr"){
                // nothing before :
                new RawJSCtx(slice, "undefined")
            }
            return new AbstractExprCtx(slice, false)
        }
        console.log(this, token, value)
        $_SyntaxError(context, 'unexpected token after object item')
    }

    this.transform = function(node, rank){
        if(this.tree.length == 2){
            // insert node to set value of varname inside the loop
            node.insert(0, NodeJS('locals.' + this.varname + ' = ' +
                this.varname))
        }
    }

    this.to_js = function(){
        return $to_js(this.tree)
    }
}

var OpCtx = function(context,op){
    // Class for operators ; context is the left operand
    this.type = 'op'
    this.op = op
    this.parent = context.parent
    this.tree = [context]
    this.scope = $get_scope(this)

    // Get type of left operand
    if(context.type == "expr"){
        if(['int', 'float', 'str'].indexOf(context.tree[0].type) > -1){
            this.left_type = context.tree[0].type
        }else if(context.tree[0].type == "id"){
            var binding = this.scope.binding[context.tree[0].value]
            if(binding){this.left_type = binding.type}
        }
    }

    // operation replaces left operand
    context.parent.tree.pop()
    context.parent.tree.push(this)

    this.transition = function(token, value){
        var context = this
        if(context.op === undefined){
            $_SyntaxError(context,['context op undefined ' + context])
        }

        switch(token) {
            case 'id':
            case 'int':
            case 'float':
            case 'str':
            case '[':
            case '(':
                return $transition(new AbstractExprCtx(context, false),
                    token, value)
            case 'op':
                switch(value){
                    case '+':
                    case '-':
                        return new UnaryCtx(context, value)
                }
            default:
                if(context.tree[context.tree.length - 1].type ==
                        'abstract_expr'){
                    $_SyntaxError(context, 'token ' + token + ' after ' +
                        context)
                }
        }
        return $transition(context.parent, token)
    }

    this.toString = function(){
        return '(op ' + this.op + ') [' + this.tree + ']'
    }

    this.to_js = function(){
        this.js_processed = true
        var comps = {'==': 'eq','!=': 'ne','>=': 'ge','<=': 'le',
            '<': 'lt','>': 'gt'},
            left = this.tree[0].to_js(),
            right = this.tree[1].to_js(),
            args = left + ', ' + right
        switch(this.op){
            case '&&':
                return left + ' && ' + right
            case 'is':
                return left + ' === ' + right
            case 'is_not':
                return left + ' !== ' + right
            case '||':
                return left + ' || ' + right
            case '==':
            case '>=':
            case '>':
            case '<':
            case '<=':
                return '$M.compare.' + comps[this.op] + '(' + args + ')'
            case '!=':
                return '! $M.compare.eq(' + args + ')'
            case '+':
                return '$M.operations.add(' + args + ')'
            case '-':
                return '$M.operations.sub(' + args + ')'
            case '%':
                return '$M.operations.mod(' + args + ')'
            case '*':
                return '$M.operations.mul(' + args + ')'
            case '/':
                return '$M.operations.div(' + args + ')'
            case '//':
                return '$M.operations.floordiv(' + args + ')'
            case '<-':
                return '$M.is_member(' + args + ')'
            case 'unary_neg':
                return '-' + right
            case 'unary_pos':
                return right
            default:
                console.log("unhandled", this.op)
        }
    }
}

var OutputCtx = function(context){
    this.type = 'output'
    this.tree = []
    this.parent = context
    context.tree[context.tree.length] = this
}

OutputCtx.prototype.transition = function(token, value){
    return $transition(this.parent, token, value)
}

OutputCtx.prototype.to_js = function(){
    return `$M.display(${this.tree[0].to_js()})`
}

var RawJSCtx = function(context, js){
    this.type = "raw_js"
    context.tree[context.tree.length] = this
    this.parent = context

    this.toString = function(){return '(js) ' + js}

    this.to_js = function(){
        this.js_processed = true
        return js
    }
}

var SliceCtx = function(context){
    // Class for slices inside a subscription : t[1:2]
    this.type = 'slice'
    this.parent = context
    if(context.type === "object"){
        // replace context by this
        context.parent.tree.pop()
        context.parent.tree.push(this)
        if(context.tree.length == 1 &&
                context.tree[0].tree[0].type == 'abstract_expr'){
            context.tree.pop()
        }
    }
    this.tree = context.tree.length > 0 ? [context.tree.pop()] : []
    context.tree.push(this)


    this.transition = function(token, value){
        var context = this
        if(token == ":"){
            return new AbstractExprCtx(context, false)
        }
        return $transition(context.parent, token, value)
    }

    this.to_js = function(){
        for(var i = 0; i < this.tree.length; i++){
            if(this.tree[i].type == "abstract_expr"){
                this.tree[i].to_js = function(){return "undefined"}
            }
        }
        if(this.parent.type == "sub"){
            return "[" + $to_js(this.tree) + "]"
        }else{
            return "$M.range(" + $to_js(this.tree) + ")"
        }
    }
}

var StringCtx = function(context,value){
    // Class for literal strings
    this.type = 'str'
    this.parent = context
    this.tree = [value] // may be extended if consecutive strings eg 'a' 'b'
    context.tree[context.tree.length] = this
    this.raw = false

    this.transition = function(token, value){
        var context = this
        switch(token) {
            case '[':
                return new AbstractExprCtx(new SubCtx(context.parent),
                    false)
            case '(':
                // Strings are not callable. We replace the string by a call
                // to an object that will raise the correct exception
                context.parent.tree[0] = context
                return new CallCtx(context.parent)
            case 'str':
                context.tree.push(value)
                return context
        }
        return $transition(context.parent, token, value)
    }

    this.toString = function(){return 'string ' + (this.tree || '')}

    this.to_js = function(){
        var res = '',
            type = null,
            scope = $get_scope(this)

        function fstring(parsed_fstring){
            // generate code for a f-string
            // parsed_fstring is an array, the result of $M.parse_fstring()
            // in py_string.js
            var elts = []
            for(var i = 0; i < parsed_fstring.length; i++){
                if(parsed_fstring[i].type == 'expression'){
                    var expr = parsed_fstring[i].expression
                    // search specifier
                    var pos = 0,
                        br_stack = [],
                        parts = [expr]

                    while(pos < expr.length){
                        var car = expr.charAt(pos)
                        if(car == ":" && br_stack.length == 0){
                            parts = [expr.substr(0, pos),
                                expr.substr(pos + 1)]
                            break
                        }else if("{[(".indexOf(car) > -1){
                            br_stack.push(car)
                        }else if(")]}".indexOf(car) > -1){
                            br_stack.pop()
                        }
                        pos++
                    }
                    expr = parts[0]
                    // We transform the source code of the expression using ml2js.
                    // This gives us a node whose structure is always the same.
                    // The Javascript code matching the expression is the first
                    // child of the first "try" block in the node's children.
                    var save_pos = $pos
                    var expr_node = $M.ml2js(expr, scope.module, scope.id, scope)
                    $pos = save_pos
                    for(var j = 0; j < expr_node.children.length; j++){
                        var node = expr_node.children[j]
                        if(node.context.tree && node.context.tree.length == 1 &&
                                node.context.tree[0] == "try"){
                            // node is the first "try" node
                            for(var k = 0; k < node.children.length; k++){
                                // Ignore line num children if any
                                if(node.children[k].is_line_num){continue}
                                // This is the node with the translation of the
                                // f-string expression.
                                var expr1 = node.children[k].to_js()
                                // Remove trailing newline and ;
                                while("\n;".indexOf(expr1.charAt(expr1.length - 1)) > -1){
                                    expr1 = expr1.substr(0, expr1.length - 1)
                                }
                                break
                            }
                            break
                        }
                    }
                    switch(parsed_fstring[i].conversion){
                        case "a":
                            expr1 = '_b_.ascii(' + expr1 + ')'
                            break
                        case "r":
                            expr1 = '_b_.repr(' + expr1 + ')'
                            break
                        case "s":
                            expr1 = '_b_.str.$(' + expr1 + ')'
                            break
                    }

                    var fmt = parts[1]
                    if(fmt !== undefined){
                        // Format specifier can also contain expressions
                        var parsed_fmt = $M.parse_fstring(fmt)
                        if(parsed_fmt.length > 1){
                            fmt = fstring(parsed_fmt)
                        }else{
                            fmt = "'" + fmt + "'"
                        }
                        var res1 = "_b_.str.$format('{0:' + " +
                            fmt + " + '}', [" + expr1 + "])"
                        elts.push(res1)
                    }else{
                        if(parsed_fstring[i].conversion === null){
                            expr1 = '_b_.str.$(' + expr1 + ')'
                        }
                        elts.push(expr1)
                    }
                }else{
                    var re = new RegExp("'", "g")
                    var elt = parsed_fstring[i].replace(re, "\\'")
                                               .replace(/\n/g, "\\n")
                    elts.push("'" + elt + "'")
                }
            }
            return elts.join(' + ')
        }

        for(var i = 0; i < this.tree.length; i++){
            if(this.tree[i].type == "call"){
                // syntax like "hello"(*args, **kw) raises TypeError
                // cf issue 335
                var js = '(function(){throw TypeError.$factory("' + "'str'" +
                    ' object is not callable")}())'
                return js
            }else{
                var value = this.tree[i],
                    is_fstring = Array.isArray(value),
                    is_bytes = false

                if(!is_fstring){
                    is_bytes = value.charAt(0) == 'b'
                }

                if(type == null){
                    type = is_bytes
                    if(is_bytes){res += 'bytes.$factory('}
                }else if(type != is_bytes){
                    return '$M.$TypeError("can\'t concat bytes to str")'
                }
                if(!is_bytes){
                    if(is_fstring){
                        res += fstring(value)
                    }else{
                        res += value.replace(/\n/g,'\\n\\\n')
                    }
                }else{
                    res += value.substr(1).replace(/\n/g,'\\n\\\n')
                }
                if(i < this.tree.length - 1){res += '+'}
            }
        }
        if(is_bytes){res += ',"ISO-8859-1")'}
        if(res.length == 0){res = '""'}
        this.js_processed = res
        return res
    }
}

function StructCtx(context){
    // context is an id, and is the right part of an assignment

    this.type = "struct"
    context.parent.tree.pop()
    context.parent.tree.push(this)
    this.parent = context.parent
    this.tree = [context]
    this.params = [[context.tree[0].value]]
    this.expect = ","

    this.transition = function(token, value){
        var context = this
        switch(token){
            case 'id':
                if(context.expect == 'id'){
                    context.params.push(value)
                    context.expect = ":"
                    return context
                }
                $_SyntaxError(context, ["struct expects an identifier"])
            case ':':
                if(context.expect == ':'){
                    // default value : replace last parameter name by a
                    // list [param name, rank of default value in context.tree]
                    var param = context.params.pop()
                    context.params.push([param])
                    context.expect = ","
                    return new AbstractExprCtx(context, false)
                }
                $_SyntaxError(context, ["unexpected : in struct definition"])
            case ',':
                if(context.expect == ','){
                    this.params[this.params.length - 1].push(this.tree.pop())
                    context.expect = 'id'
                    return context
                }
                $_SyntaxError(context, ["unexpected , in struct definition"])
            case 'eol':
                if(context.expect == ','){
                    this.params[this.params.length - 1].push(this.tree.pop())
                    for(const param of context.params){
                        if(typeof param == "string"){
                            $_SyntaxError(context, "missing value for " + param)
                        }
                    }
                    return context.parent
                }
                $_SyntaxError(context, ["struct expects an identifier"])
            default:
                $_SyntaxError(context, 'token ' + token)
        }
    }

    this.to_js = function(){
        console.log("struct", this)
        var names = []
        for(const param of this.params){
            names.push(param[0] + ': ' + param[1].to_js())
        }
        return  '$M.struct({' + names.join(', ') + '})'
    }

}

var SubCtx = function(context){
    // Class for subscription or slicing, eg x in t[x]
    context.name = "sub"
    this.type = 'sub'
    this.func = 'getitem' // set to 'setitem' if assignment
    this.value = context.tree[0]
    context.tree.pop()
    context.tree.push(this)
    this.parent = context
    this.tree = []

    this.transition = function(token, value){
        var context = this
        // subscription x[a] or slicing x[a:b:c]
        switch(token) {
            case 'id':
            case 'int':
            case 'float':
            case 'str':
            case '[':
            case '(':
                var expr = new AbstractExprCtx(context,false)
                return $transition(expr, token, value)
            case ']':
                if(context.parent.packed){
                    return context.parent.tree[0]
                }
                if(context.tree[0].tree.length > 0){
                    return context.parent
                }
                break
            case ':':
                return new AbstractExprCtx(new SliceCtx(context), false)
            case ',':
                return new AbstractExprCtx(context, false)

        }
        $_SyntaxError(context, 'token ' + token + ' after ' + context)

    }

    this.toString = function(){
        return '(sub) (value) ' + this.value + ' (tree) ' + this.tree
    }

    this.to_js = function(){
        return '$M.' + this.func + '(' + this.value.to_js() + ', ' +
            $to_js(this.tree) + ')'
    }
}

var UnaryCtx = function(context,op){
    // Class for unary operators : - and ~
    this.type = 'unary'
    this.op = op
    this.parent = context
    context.tree[context.tree.length] = this

    this.transition = function(token, value){
        console.log("unary", context, token, value)
        var context = this
        switch(token) {
            case 'int':
            case 'float':
                // replace by real value of integer or float
                // parent of context is a ExprCtx
                // grand-parent is a AbstractExprCtx
                // we remove the ExprCtx and trigger a transition
                // from the $AbstractExpCtx with an integer or float
                // of the correct value
                var expr = context.parent
                context.parent.parent.tree.pop()
                if(context.op == '-'){value = "-" + value}
                return $transition(context.parent.parent, token, value)
            case 'id':
                // replace by x.__neg__(), x.__invert__ or x.__pos__
                context.parent.parent.tree.pop()
                var expr = new ExprCtx(context.parent.parent, 'call',
                    false)
                var expr1 = new ExprCtx(expr, 'id', false)
                new IdCtx(expr1, value) // create id
                var repl = new AttrCtx(expr)
                if(context.op == '+'){repl.name = '__pos__'}
                else if(context.op == '-'){repl.name = '__neg__'}
                // new context is the expression above the id
                return expr1
            case 'op':
                if('+' == value || '-' == value){
                   if(context.op === value){context.op = '+'}
                   else{context.op = '-'}
                   return context
                }
        }
        return $transition(context.parent, token, value)

    }

    this.toString = function(){return '(unary) ' + this.op}

    this.to_js = function(){
        this.js_processed = true
        return this.op
    }
}

var $add_line_num = function(node,rank){
    if(node.type == 'module'){
        var i = 0
        while(i < node.children.length){
            i += $add_line_num(node.children[i], i)
        }
    }else if(node.type !== 'marker'){
        var elt = node.context.tree[0],
            offset = 1,
            flag = true,
            pnode = node
        while(pnode.parent !== undefined){pnode = pnode.parent}
        var mod_id = pnode.id
        // ignore lines added in transform()
        var line_num = node.line_num || node.forced_line_num
        if(line_num === undefined){flag = false}
        // Don't add line num before try,finally,else,elif
        // because it would throw a syntax error in Javascript
        if(elt.type == 'condition' && elt.token == 'elif'){flag = false}
        else if(elt.type == 'except'){flag = false}
        else if(elt.type == 'single_kw'){flag = false}
        if(flag){
            // add a trailing None for interactive mode
            var js = 'locals.$line_info = "' + line_num + ',' +
                mod_id + '";'

            var new_node = new $Node()
            new_node.is_line_num = true // used in generators
            new NodeJSCtx(new_node, js)
            node.parent.insert(rank, new_node)
            offset = 2
        }
        var i = 0
        while(i < node.children.length){
            i += $add_line_num(node.children[i], i)
        }
        // At the end of a "while" or "for" loop body, add a line to reset
        // line number to that of the "while" or "for" loop (cf issue #281)
        if((elt.type == 'condition' && elt.token == "while")
                || node.context.type == 'for'){
            if($M.last(node.children).context.tree[0].type != "return"){
                node.add(NodeJS('locals.$line_info = "' + line_num +
                    ',' + mod_id + '";'))
            }
        }

        return offset
    }else{
        return 1
    }
}

$M.$add_line_num = $add_line_num

var $bind = function(name, scope, context){
    // Bind a name in scope:
    // - add the name in the attribute "binding" of the scope
    // - add it to the attribute "bindings" of the node, except if no_bindings
    //   is set, which is the case for "for x in A" : if A is empty the name
    //   has no value (issue #1233)

    if(! context.no_bindings){
        var node = $get_node(context)
        // Add name to attribute "bindings" of node. Used in IdCtx.boundBefore()
        node.bindings = node.bindings || {}
        node.bindings[name] = true
    }

    scope.binding = scope.binding || {}
    if(scope.binding[name] === undefined){
        scope.binding[name] = true
    }else{
        // This is not the first binding in scope
        context.already_bound = true
    }
}

var $previous = function(context){
    var previous = context.node.parent.children[
            context.node.parent.children.length - 2]
    if(!previous || !previous.context){
        $_SyntaxError(context, 'keyword not following correct keyword')
    }
    return previous.context.tree[0]
}

var $get_docstring = function(node){
    var doc_string = ''
    if(node.children.length > 0){
        var firstchild = node.children[0]
        if(firstchild.context.tree && firstchild.context.tree.length > 0 &&
                firstchild.context.tree[0].type == 'expr'){
            var expr = firstchild.context.tree[0].tree[0]
            // Set as docstring if first child is a string, but not a f-string
            if(expr.type == 'str' && !Array.isArray(expr.tree[0])){
                doc_string = firstchild.context.tree[0].tree[0].to_js()
            }
        }
    }
    return doc_string
}

var $get_scope = function(context, flag){
    // Return the instance of $Node indicating the scope of context
    // Return null for the root node
    var ctx_node = context.parent
    while(ctx_node.type !== 'node'){ctx_node = ctx_node.parent}
    var tree_node = ctx_node.node,
        scope = null
    while(tree_node.parent && tree_node.parent.type !== 'module'){
        var ntype = tree_node.parent.context.tree[0].type

        switch (ntype) {
            case 'def':
            case 'when':
                var scope = tree_node.parent
                scope.ntype = 'def'
                scope.is_function = true
                return scope
        }
        tree_node = tree_node.parent
    }
    var scope = tree_node.parent || tree_node // module
    scope.ntype = "module"
    return scope
}

var $get_module = function(context){
    // Return the instance of $Node for the module where context
    // is defined
    var ctx_node = context.parent
    while(ctx_node.type !== 'node'){ctx_node = ctx_node.parent}
    var tree_node = ctx_node.node
    if(tree_node.ntype == "module"){return tree_node}
    var scope = null
    while(tree_node.parent.type != 'module'){
        tree_node = tree_node.parent
    }
    var scope = tree_node.parent // module
    scope.ntype = "module"
    return scope
}

var $get_src = function(context){
    // Get the source code of context module
    var node = $get_node(context)
    while(node.parent !== undefined){node = node.parent}
    return node.src
}

var $get_node = function(context){
    var ctx = context
    while(ctx.parent){
        ctx = ctx.parent
    }
    return ctx.node
}

var $to_js_map = function(tree_element) {
    if(tree_element.to_js !== undefined){return tree_element.to_js()}
    throw Error('no to_js() for ' + tree_element)
}

var $to_js = function(tree,sep){
    if(sep === undefined){sep = ','}

    return tree.map($to_js_map).join(sep)
}

// Function called in function $tokenize for each token found in the
// Python source code

var $transition = function(context, token, value){
    // console.log("context", context, "token", token, value)
    //alert()
    return context.transition(token, value)
}

var s_escaped = 'abfnrtvxuU"0123456789' + "'" + '\\',
    is_escaped = {}
for(var i = 0; i < s_escaped.length; i++){
    is_escaped[s_escaped.charAt(i)] = true
}

var kwdict = ["def", "exit", "if", "import", "loop"]

var IDStart = /\p{L}|_/u,
    IDContinue = /\p{L}|[0-9]|_/u

var $tokenize = function(root, src) {
    var br_close = {")": "(", "]": "["},
        br_stack = "",
        br_pos = []
    var unsupported = []
    var $indented = [
        "def", "condition", "loop"
    ]

    var int_pattern = /^(\d[0-9_]*)/,
        float_pattern1 = /^(\d[\d_]*)\.(\d*)([eE][+-]?\d+(_\d+)*)?/,
        float_pattern2 = /^(\d[\d_]*)([eE][+-]?\d+(_\d+)*)/

    var context = null
    var new_node = new $Node(),
        current = root,
        name = "",
        _type = null,
        pos = 0,
        indent = null

    var module = root.module

    var lnum = root.line_num || 1
    while(pos < src.length){
        var car = src.charAt(pos)
        // build tree structure from indentation
        if(indent === null){
            var indent = 0
            while(pos < src.length){
                var _s = src.charAt(pos)
                if(_s == " "){indent++; pos++}
                else if(_s == "\t"){
                    // tab : fill until indent is multiple of 8
                    indent++; pos++
                    if(indent % 8 > 0){indent += 8 - indent % 8}
                }else{break}
            }
            // ignore empty lines
            var _s = src.charAt(pos)
            if(_s == '\n'){
                pos++; lnum++; indent = null; continue
            }else if(_s == '#'){ // comment
                var offset = src.substr(pos).search(/\n/)
                if(offset == -1){break}
                pos += offset + 1
                lnum++
                indent = null
                continue
            }
            new_node.indent = indent
            new_node.line_num = lnum
            new_node.module = module

            if(current.is_body_node){
                // A "body node" starts after the ":" and has no indent
                // initially set, so we take the number of spaces after the ":"
                current.indent = indent
            }

            // attach new node to node with indentation immediately smaller
            if(indent > current.indent){
                if(context !== null){
                    if($indented.indexOf(context.tree[0].type) == -1){
                        $pos = pos
                        if(current.context.tree.length == 1){
                            var expr = current.context.tree[0]
                            if(expr.type == "expr" &&
                                    expr.tree[0].type == "id"){
                                current.context.tree = []
                                var def = new DefCtx(current.context)
                                def.set_name(expr.tree[0].value)
                                /*
                                $bind(expr.tree[0].value, $get_scope(expr),
                                    current.context)
                                */
                            }
                        }else{
                            $_SyntaxError(context, 'unexpected indent', pos)
                        }
                    }
                }
                // add a child to current node
                current.add(new_node)
            }else if(indent <= current.indent && context && context.tree[0] &&
                    $indented.indexOf(context.tree[0].type) > -1 &&
                    context.tree.length < 2){
                $pos = pos
                $_SyntaxError(context, 'expected an indented block',pos)
            }else{ // same or lower level
                while(indent !== current.indent){
                    current = current.parent
                    if(current === undefined || indent > current.indent){
                        $pos = pos
                        $_SyntaxError(context, 'unexpected indent', pos)
                    }
                }
                current.parent.add(new_node)
            }
            current = new_node
            context = new NodeCtx(new_node)
            continue
        }
        // comment
        if(car == "#"){
            var end = src.substr(pos + 1).search('\n')
            if(end == -1){end = src.length - 1}
            // Keep track of comment positions
            root.comments.push([pos, end])
            pos += end + 1
            continue
        }
        // string
        if(car == '"' || car == "'"){
            var end = null
            _type = "string"
            end = pos + 1

            var escaped = false,
                zone = car,
                found = false
            while(end < src.length){
                if(escaped){
                    if(src.charAt(end) == "a"){
                        zone = zone.substr(0, zone.length - 1) + "\u0007"
                    }else{
                        zone += src.charAt(end)
                        if(raw && src.charAt(end) == '\\'){zone += '\\'}
                    }
                    escaped = false
                    end++
                }else if(src.charAt(end) == "\\"){
                    if(end < src.length - 1 &&
                        is_escaped[src.charAt(end + 1)] === undefined){
                            zone += '\\'
                    }
                    zone += '\\'
                    escaped = true
                    end++
                }else if(src.charAt(end) == car){
                    found = true
                    // end of string
                    $pos = pos
                    // Escape quotes inside string, except if they are
                    // already escaped.
                    // In raw mode, always escape.
                    var $string = zone.substr(1), string = ''
                    for(var i = 0; i < $string.length; i++){
                        var $car = $string.charAt(i)
                        if($car == car &&
                                (raw || (i == 0 ||
                                    $string.charAt(i - 1) != '\\'))){
                            string += '\\'
                        }
                        string += $car
                    }

                    context = $transition(context, 'str',
                        car + string + car)
                    pos = end + 1
                    break
                }else{
                    zone += src.charAt(end)
                    if(src.charAt(end) == '\n'){lnum++}
                    end++
                }
            }
            if(!found){
                $_SyntaxError(context, "String end not found")
            }
            continue
        }
        // identifier ?
        if(name == ""){
            if(car.match(IDStart)){
                name = car // identifier start
                var p0 = pos
                pos++
                while(pos < src.length &&
                        src.charAt(pos).match(IDContinue)){
                    name += src.charAt(pos)
                    pos++
                }
            }
            if(name){
                if(kwdict.indexOf(name) > -1){
                    $pos = pos - name.length
                    if(unsupported.indexOf(name) > -1){
                        $_SyntaxError(context,
                            "Unsupported Python keyword '" + name + "'")
                    }
                    context = $transition(context, name)
                }else if(typeof $operators[name] == 'string' &&
                        ['is_not', 'not_in'].indexOf(name) == -1){
                    // Literal operators : "and", "or", "is", "not"
                    // The additional test is to exclude the name "constructor"
                    if(name == 'is'){
                        // if keyword is "is", see if it is followed by "not"
                        var re = /^\s+not\s+/
                        var res = re.exec(src.substr(pos))
                        if(res !== null){
                            pos += res[0].length
                            $pos = pos - name.length
                            context = $transition(context, 'op', 'is_not')
                        }else{
                            $pos = pos - name.length
                            context = $transition(context, 'op', name)
                        }
                    }else if(name == 'not'){
                        // if keyword is "not", see if it is followed by "in"
                        var re = /^\s+in\s+/
                        var res = re.exec(src.substr(pos))
                        if(res !== null){
                            pos += res[0].length
                            $pos = pos - name.length
                            context = $transition(context, 'op', 'not_in')
                        }else{
                            $pos = pos - name.length
                            context = $transition(context, name)
                        }
                    }else{
                        $pos = pos - name.length
                        context = $transition(context, 'op', name)
                    }
                }else{
                    $pos = pos - name.length
                    context = $transition(context, 'id', name)
                }
                name = ""
                continue
            }
        }

        function rmuf(numeric_literal){
            // Remove underscores inside a numeric literal (PEP 515)
            // Raises SyntaxError for consecutive or trailing underscore
            if(numeric_literal.search("__") > -1){
                // consecutive underscores is a syntax error
                $_SyntaxError(context, "invalid literal")
            }else if(numeric_literal.endsWith("_")){
                // trailing underscore is a syntax error
                $_SyntaxError(context, "invalid literal")
            }
            return numeric_literal.replace(/_/g, "")
        }

        function check_int(numeric_literal){
            // Check that the integer in numeric_literal is valid :
            // same control as rmuf above + special case for integers
            // starting with 0
            rmuf(numeric_literal)
            if(numeric_literal.startsWith("0")){
                if(numeric_literal.substr(1).search(/[^0_]/) > -1){
                    // 007 or 0_7 is invalid, only 0_0 is ok
                    $_SyntaxError(context, "invalid literal")
                }else{
                    return "0"
                }
            }
        }

        function rmu(numeric_literal){
            return numeric_literal.replace(/_/g, "")
        }

        switch(car) {
            case ' ':
            case '\t':
                pos++
                break
            case '.':
                if(pos < src.length - 1 && /^\d$/.test(src.charAt(pos + 1))){
                    // number starting with . : add a 0 before the point
                    var j = pos + 1
                    while(j < src.length &&
                        src.charAt(j).search(/\d|e|E|_/) > -1){j++}

                    context = $transition(context, 'float',
                        '0' + rmu(src.substr(pos, j - pos)))

                    pos = j
                    break
                }else if(src.substr(pos, 3) == '...'){
                    context = $transition(context, '...') // loop
                    pos += 3
                    break
                }
                $pos = pos
                context = $transition(context, '.')
                pos++
                break
            case '0':
              // literal like "077" is not valid
              if(src.charAt(pos + 1).search(/\d/) > -1){
                  if(parseInt(src.substr(pos)) === 0){
                      res = int_pattern.exec(src.substr(pos))
                      $pos = pos
                      check_int(res[0])
                      context = $transition(context, 'int',
                          [10, rmu(res[0])])
                      pos += res[0].length
                      break
                  }else{$_SyntaxError(context,
                      'invalid literal starting with 0')}
              }
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                // digit
                var res = float_pattern1.exec(src.substr(pos))
                if(res){
                    check_int(res[1]) // check that the part before "." is ok
                    if(res[2]){rmuf(res[2])} // same for the part after "."
                    $pos = pos
                    context = $transition(context, 'float', rmuf(res[0]))
                }else{
                    res = float_pattern2.exec(src.substr(pos))
                    if(res){
                        check_int(res[1]) // check the part before "e"
                        $pos = pos
                        context = $transition(context, 'float', rmuf(res[0]))
                    }else{
                        res = int_pattern.exec(src.substr(pos))
                        check_int(res[1])
                        $pos = pos

                        context = $transition(context, 'int',
                            [10, rmu(res[0])])
                    }
                }
                pos += res[0].length
                break
            case '\n':
                // line end
                lnum++
                if(br_stack.length > 0){
                    // implicit line joining inside brackets
                    pos++
                }else{
                    if(current.context.tree.length > 0){
                        $pos = pos
                        context = $transition(context, 'eol')
                        indent = null
                        new_node = new $Node()
                    }else{
                        new_node.line_num = lnum
                    }
                    pos++
                }
                break
            case '(':
            case '[':
                br_stack += car
                br_pos[br_stack.length - 1] = [context, pos]
                $pos = pos
                context = $transition(context, car)
                pos++
                break
            case ')':
            case ']':
                if(br_stack == ""){
                    $pos = pos
                    $_SyntaxError(context, "Unexpected closing bracket")
                }else if(br_close[car] !=
                        br_stack.charAt(br_stack.length - 1)){
                    $pos = pos
                    $_SyntaxError(context, "Unbalanced bracket")
                }else{
                    br_stack = br_stack.substr(0, br_stack.length - 1)
                    $pos = pos
                    context = $transition(context, car)
                    pos++
                }
                break
            case '=':
                if(src.charAt(pos + 1) != "="){
                    $pos = pos
                    context = $transition(context, '=')
                    pos++
                }else{
                    $pos = pos
                    context = $transition(context, 'op', '==')
                    pos += 2
                }
                break
            case ',':
            case ':':
                $pos = pos
                context = $transition(context, car)
                pos++
                break
            case '/':
            case '%':
            case '>':
            case '<':
            case '-':
            case '+':
            case '*':
            case '/':
            case '!':
            case '&':
            case '|':
                // Operators
                var car2 = src.substr(pos, 2),
                    flag = false
                switch(car2){
                    case '->':
                        context = $transition(context, car2)
                        pos += 2
                        flag = true
                        break
                }

                if(flag){
                    break
                }

                if(augmented_operators.includes(car2)){
                    context = $transition(context, car2)
                    pos += 2
                    break
                }

                // find longest match
                var op_match = ""
                for(var op_sign in $operators){
                    if(op_sign == src.substr(pos, op_sign.length)
                            && op_sign.length > op_match.length){
                        op_match = op_sign
                    }
                }
                $pos = pos
                if(op_match.length > 0){
                    context = $transition(context, 'op', op_match)
                    pos += op_match.length
                }else if(car == '!'){
                    context = $transition(context, 'op', car)
                    pos += 1
                }else{
                    $_SyntaxError(context, 'invalid character: ' + car)
                }
                break
            case '\\':
                if(src.charAt(pos + 1) == '\n'){
                  lnum++
                  pos += 2
                  break
                }else{
                    $pos = pos
                    $_SyntaxError(context,
                        ['unexpected character after line continuation character'])
                }
            case String.fromCharCode(12): // Form Feed : ignore
                pos += 1
                break
            case '?':
                // if (previous expression)
                context = $transition(context, '?')
                pos++
                break
            case '@':
                context = $transition(context, '@')
                pos++
                break
            default:
                $pos = pos
                $_SyntaxError(context, 'unknown token [' + car + ' (' +
                    car.codePointAt(0) + ')]')
        }
    }

    if(br_stack.length != 0){
        var br_err = br_pos[0]
        $pos = br_err[1]
        var lines = src.split("\n"),
            id = root.id,
            fname = id.startsWith("$") ? '<string>' : id
        $_SyntaxError(br_err[0],
            ["unexpected EOF while parsing (" + fname + ", line " +
                (lines.length - 1) + ")"])
    }
    if(context !== null && context.tree[0] &&
            $indented.indexOf(context.tree[0].type) > -1){
        $pos = pos - 1
        $_SyntaxError(context, 'expected an indented block', pos)
    }

}

var $create_root_node = function(src, module,
        locals_id, parent_block, line_num){
    var root = new $Node('module')
    root.module = module
    root.id = locals_id
    root.binding = {
        __doc__: true,
        __name__: true,
        __file__: true,
        __package__: true
    }

    root.parent_block = parent_block
    root.line_num = line_num
    root.indent = -1
    root.comments = []
    root.imports = {}
    root.src = src

    return root
}

$M.ml2js = function(src, module, locals_id, parent_scope, line_num){
    // src = Python source (string)
    // module = module name (string)
    // locals_id = the id of the block that will be created
    // parent_scope = the scope where the code is created
    // line_info = [line_num, parent_block_id] if debug mode is set
    //
    // Returns a tree structure representing the Python source code
    $pos = 0
    $M.src = src

    parent_scope = parent_scope || $M.builtins_scope

    // Normalise line ends
    src = src.replace(/\r\n/gm, "\n")

    var lines = src.split("\n")

    // Remove trailing \, cf issue 970
    // but don't hide syntax error if ends with \\, cf issue 1210
    if(src.endsWith("\\") && !src.endsWith("\\\\")){
        src = src.substr(0, src.length - 1)
    }
    // Normalise script end
    if(src.charAt(src.length - 1) != "\n"){src += "\n"}

    var local_ns = 'locals_' + locals_id.replace(/\./g,'_')

    var global_ns = 'locals_' + module.replace(/\./g,'_')

    var root = $create_root_node(src, module, locals_id, parent_scope, line_num)

    $tokenize(root, src)

    root.transform()

    // Create internal variables
    var js = ['var $M = __MINILANG__,\n',
              '    _b_ = __MINILANG__.builtins,\n',
              '    locals = ' + local_ns]
        pos = js.length

    var offset = 0

    root.insert(0, NodeJS(js.join('')))
    offset++

    // Code to create the execution frame and store it on the frames stack
    var enter_frame_pos = offset,
        js = '$M.frames_stack.push(locals);'
    root.insert(offset++, NodeJS(js))

    // Wrap code in a try/finally to make sure we leave the frame
    var try_node = new NodeJS('try'),
        children = root.children.slice(enter_frame_pos + 1,
            root.children.length)
    root.insert(enter_frame_pos + 1, try_node)

    // Add module body to the "try" clause
    if(children.length == 0){children = [NodeJS('')]} // in case the script is empty
    children.forEach(function(child){
        try_node.add(child)
    })
    // add node to exit frame in case no exception was raised
    try_node.add(NodeJS('$M.leave_frame()'))

    root.children.splice(enter_frame_pos + 2, root.children.length)

    var catch_node = NodeJS('catch(err)')
    catch_node.add(NodeJS('err.frames = err.frames || $M.frames_stack.slice()'))
    catch_node.add(NodeJS('$M.leave_frame()'))
    catch_node.add(NodeJS('throw err'))

    root.add(catch_node)

    $add_line_num(root, null, module)

    return root
}



window.addEventListener("load", function(){

})

$M.$operators = $operators
$M.$Node = $Node
$M.NodeJSCtx = NodeJSCtx

$M.minilang = minilang


})(__MINILANG__)

var minilang = __MINILANG__.minilang

