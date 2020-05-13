__MINILANG__.imported["io"] = {
    print: function(){
        var args = []
        for(var i = 0, len = arguments.length; i < len; i++){
            args.push(__MINILANG__.repr(arguments[i]))
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
    },
    input: function(message, callback){
        var div = document.createElement("div")
        div.style.position = "absolute"
        div.style.left = "100px"
        div.style.top = "100px"
        div.style.backgroundColor = "#ddd"
        div.style.padding = "20px"

        div.appendChild(document.createTextNode(message))

        var input = document.createElement("input")
        div.appendChild(input)
        var ok = document.createElement("button")
        ok.appendChild(document.createTextNode("Ok"))
        div.appendChild(ok)

        ok.addEventListener("click", function(){
            var text = input.value
            div.remove()
            return callback(text)
        })

        document.body.appendChild(div)

        return div
    }
}