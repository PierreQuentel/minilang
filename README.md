Data types
==========

numbers
-------

```python
# integer
x = 1

# float
y = 3.14
```

strings
-------

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
s = 'abcd'
s[0] # 'a'
s[10] # raises an error

# same result without []
s 0 # 'a'

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

tables
------

```python
# definition with comma-separated values inside square brackets []
# values can be simple items
t = ["a", 1, 3.14]

# or key-value pairs
d = [x=0, "min-height"=100] # quotes for keys that are not valid identifiers

# simple items are accessed with their index, like strings
t[2] # 3.14
t[-2] # 1

# key-value pairs are accessed by the key, either with the dotted notation
t.x # 0
# or with [], preferably only for keys than can't be used as attribute
t["min-height"] # 0

# definition as a range of integers
r = [2:5] # same as [2, 3, 4] (last number is not included)
r = [:5] # missing start = 0

t[:] # copy the whole table

# an existing element can be reset
t[0] = "b" # t is ["b", 1, 3.14]

d.x = 1 # d is [x=1, "min-height"=100]

d["min-height"] = 200 # d is [x=1, "min-height"=200]

# a sublist can be replaced by another list
t[1:2] = ["c"] # remove t[1:2] and put ["c"] instead = ["b", "c", 3.14, x=0]

# if the replacement is empty, this removes elements
t[:1] = [] # remove the first element = ["c", 3.14]
t[:] = [] # clears the list

# add an element to the items
t += [d]

# test membership
"d" <- t # true (think of the "belongs to" math sign ∈)

# concatenate two lists
t = ["a", "b"] + [:2] # ["a", "b", 0, 1]

# creating objects from a table
# define a table "Position"
Position = [x=0, y=0]

# create another table with the same keys but different values
pos = Position(2, 5)
pos.x # 2
```

Printing values
===============
```
>> ([x[, y...]])
```
prints the variables passed as arguments, separated by a whitespace and ending
with a newline

Programs
========
Programs are about conditions, loops and functions.

We use only 3 signs, one for each of these features : `?` for conditions,
`@` for loops, `=` for functions.

Each of these signs have an associated "code block", the instructions that
are executed if the condition is true / inside the loop / when the function is
called.

Additionaly, a 4th sign `->` is used to exit from a loop or return a
value from a function.


condition
---------
```
s = 4
s > 3 ?
  >> (s, "is greater than 3")
```

The code block executed if the condition before `?` is true is determined by
its indentation.

If the condition is a variable, it is considered false if it is the empty
string, the empty list, or the number 0. Otherwise it is consired true.

loop
----
Without any argument, `@` executes its code block until it finds `->`
```
x = 0
@
  x >>
  x = x + 1
  x > 5 ?
    ->
```

An argument can be specified after `@`. If it is a string or a list, the loop
is executed as many times as there are characters in the string or items in
the list. If it is a number, it is executed this number of times.

```
# get string length
s = 'abcdefg'
len = 0
@ s
    len = len + 1
>> ("length of", s, len)
```

If we want to use the characters inside the loop, we can define the name of the
variable that will hold them during iteration

```
# count the number of 'a'
s = 'abracadabra'
nb = 0
@ s:car
  car == 'a' ?
    nb = nb + 1
>> (nb, "times 'a' in", s)
```

`->` can be used in this kind of loop

```
# search if a character is inside a string
s = 'abracadadra'

searched = 'd'
@ s:car
  car == searched ?
    >> (s, "has character", searched)
    -> # no use reading next items
```

This syntax can be also used if the argument of `@` is a number

```
@ 10:i
    >> i
```

functions
---------
Functions are defined with the function name, a list of parameters and `=`.
When the function is called, its code block is executed.
```
f(x) =
    >> x
```
To define a return value, use `->` followed by the value to return:
```
double(x) =
    -> x * 2
```
Reusing the code in the `@` section, we can define a function that returns
the length of a list or a string:
```
len(x) =
  result = 0
  @ x
    result = result + 1
  -> result
```
or a function that tests if a character is inside a string
```
has(string, char) =
  @ string:c
    c == char ?
      -> "true"
  -> "false"

has("abracadabra", "a") # "true"
```

exit
----
Inside a loop, `->` can be followed by an expression if the loop is inside a
function: in this case, `->` both exits the loop and returns the function
value

The code above can be more concise
```
has(string, char) =
    @ string:c
        c == char ?
          -> "true"
    -> "false"
```

If `->` is in a function body but not in a loop, it must be followed by an
expression.