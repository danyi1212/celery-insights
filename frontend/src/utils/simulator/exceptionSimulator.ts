interface ExceptionType {
    type: string
    message: string
}

const fakeExceptions: ExceptionType[] = [
    { type: "Exception", message: "Hello, world!" },
    { type: "KeyError", message: "'a'" },
    { type: "ValueError", message: "Invalid value." },
    { type: "TypeError", message: "NoneType object is not iterable" },
    { type: "ZeroDivisionError", message: "division by zero" },
    { type: "AttributeError", message: "'NoneType' object has no attribute 'split'" },
    { type: "ImportError", message: "No module named 'non_existent_module'" },
    { type: "IndexError", message: "list index out of range" },
    { type: "OSError", message: "[Errno 2] No such file or directory: '/path/to/file'" },
    { type: "RuntimeError", message: "maximum recursion depth exceeded in comparison" },
]

const tracebackBases: string[] = [
    'Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>',
    'Traceback (most recent call last):\n  File "<input>", line 4, in <module>',
    'Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\n  File "<stdin>", line 2, in some_function\n  File "<stdin>", line 4, in another_function',
    'Traceback (most recent call last):\n  File "<input>", line 4, in <module>\n  File "/path/to/your/script.py", line 10, in <function>\n  File "/path/to/your/script.py", line 7, in <nested_function>',
    'Traceback (most recent call last):\n  File "/path/to/your/script.py", line 27, in <method>\n  File "/another/path/to/your/script.py", line 33, in <another_method>\n  File "/yet/another/path/to/your/script.py", line 39, in <yet_another_method>',
    'Traceback (most recent call last):\n  File "/yet/another/path/to/your/script.py", line 15, in <class>\n  File "/yet/another/path/to/your/script.py", line 18, in <nested_class>\n  File "/yet/another/path/to/your/script.py", line 23, in <nested_class_method>',
    'Traceback (most recent call last):\n  File "<module>", line 20, in <module>\n  File "<module>", line 57, in a_function\n  File "<module>", line 75, in yet_another_function',
]

export const getRandomException = (): { exception: string; traceback: string } => {
    const randomIndex = Math.floor(Math.random() * fakeExceptions.length)
    const randomException = fakeExceptions[randomIndex]

    const randomTracebackBaseIndex = Math.floor(Math.random() * tracebackBases.length)
    const tracebackBase = tracebackBases[randomTracebackBaseIndex]

    return {
        exception: `${randomException.type}(${randomException.message})`,
        traceback: `${tracebackBase}\n${randomException.type}: ${randomException.message}`,
    }
}
