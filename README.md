# Data types

## numbers

```python
# integer
x = 1

# float
y = 3.14
```

## strings

```python
# with simple quotes
s1 = 'string'

# or double quotes
s2 = "string"

# on several lines
s3 = "And say, people, they don't understand
Your girlfriends, they can't understand
Your grandsons, they won't understand
On top of this, I ain't ever gonna understand"

# s[i] = get character at a position i (starts at 0)
s2[0] # 'a'
s2[10] # raises an error

# s[i:j] = get substring from position i (included) to j (not included)
s2[1:3] # 'tr'
s2[:3] # 'str' (missing first position = 0)
s2[3:] # 'ing' (missing last position = end of string)

s2[10:20] # '' (substring does not raise errors)

# position can be negative
s2[-1] # last character, 'g'

# characters cannot be changed
s2[0] = 'S' # raises an error

# concatenation with +
s = 'S' + s2[1:] # 'String'
```

lists
-----
# definition with comma-separated values
t = ["a", 1, 3.14]

# definition as a range of integers
r = [2:5] # same as [2, 3, 4] (last number is not included)
r = [:5] # missing start = 0

# same access to elements and slices as for strings
t[2] # 3.14
t[-2] # 1
t[:] # copy the whole list

# an existing element can be reset
t[0] = "b" # t is ["b", 1, 3.14]

# a sublist can be replaced by another list
t[1:2] = ["c"] # remove t[1:2] and put ["c"] instead = ["b", "c", 3.14]

# if the replacement is empty, this removes elements
t[:1] = [] # remove the first element = ["c", 3.14]
t[:] = [] # clears the list

# add an element at the end of the list
t <= "d" # think of <= as "left arrow", not "less or equal"

# concatenate two lists
t = ["a", "b"] + [:2] # ["a", "b", 0, 1]

structures
----------
An object with attributes associated to values

Position
    x = 0
    y = 0

The structure `Position` has the attributes `x` and `y`.

To get the value of an attribute, or set a value, use the dotted notation

Position.x # 0
Position.y = 1

Arbitrary attributes can be added dynamically to the structure:

Position.z = 0

A structure can be used to generate instances as if it was a function:

pos = Position(3, 5)

The attributes `x` and `y` of the object are the arguments passed to the
structure. If there are less arguments than attributes, the structure
attributes are taken as default values.

Functions can be defined inside a structure

Rectangle
  width = 0
  height = 0
  def surface(self)
    exit self.width * self.height

The instances of this structure have a method of the same name;
when called, the first argument of the function is the object

rect = Rectangle(3, 4)
rect.surface() # calls Rectangle.surface(rect)

Printing values
===============
print([x[, y...]])

prints the variables passed as arguments, separated by a whitespace and ending
with a newline

Programs
========
Programs are about conditions, loops and functions.

We use only 3 keywords, one for each of these features : `if` for conditions,
`loop` for loops, `def` for functions.

Each of these keywords have an associated "code block", the instructions that
are executed if the condition is true / inside the loop / when the function is
called.

Additionaly, a 4th keyword `exit` is used to exit from a loop or return a
value from a function.


condition
---------
s = 4
if s > 3
    print(s, "is greater than 3")

The code block executed if the condition after `if` is true is determined by
its indentation.

If the condition is a variable, it is considered false if it is the empty
string, the empty list, or the number 0. Otherwise it is consired true.

loop
----
Without any argument, `loop` executes its code block until it finds `exit`

x = 0
loop
    print(x)
    x = x + 1
    if x > 5
        exit

`exit` can be combined with `if`

x = 0
loop
    print(x)
    x = x + 1
    exit if x > 5

An argument can be specified after loop. If it is a string or a list, the loop
is executed as many times as there are characters in the string or items in
the list. If it is a number, it is executed this number of times.

# get string length
s = 'abcdefg'
len = 0
loop s
    len = len + 1
print("length of", s, len)

If we want to use the characters inside the loop, we can define the name of the
variable that will hold them during iteration

# count the number of 'a'
s = 'abracadabra'
nb = 0
loop s:car
    if car == 'a'
        nb = nb + 1
print(nb, "times 'a' in", s)

`exit` can be used in this kind of loop

# search if a character is inside a string
s = 'abracadadra'

searched = 'd'
loop s:car
    if car == searched
        print(s, "has character", searched)
        exit # no use reading next items

This syntax can be also used if the argument of `loop` is a number

loop 10:i
    print(i)


functions
---------
Functions are defined with the keyword `def` followed by a list of parameters.
When the function is called, its code block is executed.

def f(x)
    print(x)

To define a return value, use `exit` followed by the value to return:

def double(x)
    exit x * 2

Reusing the code in the `loop` section, we can define a function that returns
the length of a list of string:

def len(x)
    result = 0
    loop x
        result = result + 1
    exit result

or a function that tests if a character is inside a string

def has(string, char)
    result = "false"
    loop string:c
        if c == char
            result = "true"
            exit
    exit result

has("abracadabra", "a") # "true"

exit
----
Inside a loop, `exit` can be followed by an expression if the loop is inside a
function: in this case, `exit` both exits the loop and returns the function
value

The code above can be more concise

def has(string, char)
    loop string:c
        exit "true" if c == char
    exit "false"

If `exit` is in a function body but not in a loop, it must be followed by an
expression.