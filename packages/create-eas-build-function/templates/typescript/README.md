# EAS Build custom function

This is an EAS Build custom written in TypeScript.

## How to use it

1. Install dependencies using the package manager of your choice (npm, yarn, etc.) by running the `install` command.
2. Implement your function in `src/index.ts`.
3. Build your function using the `yarn build` command. **The [`ncc` tool](https://github.com/vercel/ncc) is required to perform this operation**. If you don't have it installed, you can install it by running `npm install -g @vercel/ncc`.
4. Use it in the custom build YAML config. For example:

    ```yml
    build:
        name: Custom build
        steps:
            - run:
                name: Hi!
                command: echo "Hello! Let's run a custom function!"
            - my_function:
                id: my-function-call
            - run:
                name: Bye!
                command: echo "Bye! The custom function has finished its job."

    functions:
        my_function:
            name: my-function
            path: path/to/my/function/module
    ```

5. Make sure that the `build` directory is not ignored in your `.gitignore` or `.easignore` file, so it can be used by the custom build process.

## Learn more

Visit the [EAS Build custom builds documentation](https://docs.expo.dev/preview/custom-build-config/) to learn more about EAS Build custom functions.
