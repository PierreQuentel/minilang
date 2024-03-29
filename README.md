Language ...->:?


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
```

Cloning a table
===============
```python
# define a table "Position"
Position = [x=0, y=0]

# create another table with the same keys but different values
pos = Position(2, 5)
pos.x # 2
```

Printing values
===============
```python
>> x
>> x , y
```
prints the variables passed as arguments

User input
==========
```python
<< x
```
opens a prompt box and stores the result in variable x

The value can be an attribute or a subscription

```python
<< x.a
<< x['n']
```

Programs
========
Programs are about conditions, loops and functions.


condition
---------
```python
s = 4
s > 3 ?
  >> (s, "is greater than 3")
```

The code block executed if the condition before `?` is true is determined by
its indentation.

If the condition is a variable, it is considered false if it is the empty
string, the empty list, or the number 0. Otherwise it is consired true.

An 'else' clause can be introduced by `|`

```python
x > 0 ?
  >> 'positive'
|
  >> 'negative'
```

loop
----
Without any argument, `...` executes its code block until it finds `->`
```python
x = 0
...
  x >>
  x = x + 1
  x > 5 ?
    ->
```

An argument can be specified after `...`. If it is a string or a list, the
loop is executed as many times as there are characters in the string or items
in the list. If it is a number, it is executed this number of times.

```python
# get string length
s = 'abcdefg'
len = 0
... s
    len = len + 1
>> ("length of", s, len)
```

If we want to use the characters inside the loop, we can define the name of the
variable that will hold them during iteration. This is done by the syntax
`... s -> car`

```python
# count the number of 'a'
s = 'abracadabra'
nb = 0
... s -> car
  car == 'a' ?
    nb = nb + 1
>> (nb, "times 'a' in", s)
```

`->` can be used in this kind of loop

```python
# search if a character is inside a string
s = 'abracadadra'

searched = 'd'
... s -> car
  car == searched ?
    >> (s, "has character", searched)
    -> # no use reading next items
```

This syntax can be also used if the argument of `...` is a number

```python
... 10 -> i
    >> i
```

functions
---------
Functions are defined with the function name, a list of parameters and `:`.
When the function is called, its code block is executed.
```python
f(x):
    >> x
```
To define a return value, use `->` followed by the value to return:
```python
double(x):
    -> x * 2
```
Reusing the code in the `...` section, we can define a function that returns
the length of a list or a string:
```python
len(x):
  result = 0
  ... x
    result = result + 1
  -> result
```
or a function that tests if a character is inside a string
```python
has(string, char):
  ... string -> c
    c == char ?
      -> "true"
  -> "false"

has("abracadabra", "a") # "true"
```

If a function has no explicit return value, `f()` is set to an undefined
object, printed as `?`

```python
f():
  ->
>> f() # prints '?'
```

The undefined value is a unique object

```python
f():
  ->
g():
  >> 'ok'

>> f() == g() # prints 'true'
```


Table methods
=============
If an attribute of a table is a function, it is called with the table as the
first argument

```python
List = [items=[]]

len(t):
  x = 0
  ... t.items
    x = x + 1
  -> x

List.len = len

>> List([4, 8, 'a']).len()
```