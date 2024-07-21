## Folders and Files

- 📁 `components`: Code for SnapLine components, like nodes and lines.
  - 📄`base.ts`: Defines the base component class.
  - 📄`component.ts`: Defines the component class.
  - 📄`connector.ts`: Defines the connector class.
  - 📄`node.ts`: Defines the node class.
- 📁 `theme`: CSS for standard SnapLine themes.
  - 📄`standard_dark.css`: Standard dark theme.
  - 📄`standard_light.css`: Standard light theme.
- 📄 `camera.ts`: Code for the camera, which is used to move the view around.
- 📄 `helper.ts`: Helper functions.
- 📄 `index.ts`: The entry point for the SnapLine library.
- 📄 `input.ts`: Code for handling user input.

## Conventions

### Class Member Function Naming

There are three types of class member functions that exist in this library:

- Private: Functions that are not meant to be accessed outside of the _class_ nor the _library_. These functions are prefixed with a pound sign (`#`), which enforces privacy in JavaScript.
- Hidden: Functions that are only called within the _library_, but can be called between _classes_. These functions are prefixed with an underscore (`_`). Technically speaking, these functions are public, but they are not meant to be accessed outside of the _library_.
- Public: Functions that are meant to be accessed outside of the _library_. These functions are not prefixed with anything.

For private and hidden functions, the bundler will mangle (minify) the function names to reduce bundle size and discourage external code from directly calling these functions.

### Class Member Variable Naming

Similar to functions, there are three types of class member variables; private, hidden, and public. Their naming conventions are the same as functions. Also like functions, private and hidden variables will be mangled by the bundler.
