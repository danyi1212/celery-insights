# Contributing to Celery Insights

Thank you for your interest in contributing to Celery Insights! This document will help guide you through the process.

## Reporting Bugs

> **IMPORTANT**
>
> If you have discovered a security vulnerability, please **DO NOT** file a public issue.
> Instead, please follow the instructions in the SECURITY.md file to report the issue securely.

If you have found a bug, we would like to know, so we can fix it! Before you file a bug report, please make sure that
the bug
can be reproduced consistently.

To report a bug, create a new GitHub Issue with the "bug" label. Make sure to include a minimal reproduction of the bug
and any steps needed to reproduce it.

Please feel free to discuss it in GitHub Discussions first. Other users may have experienced a similar issue and can
provide insights or guidance on how to overcome it.

## Asking Questions and Requesting Features

If you have any questions, ideas, or want to request a feature, feel free to discuss them in GitHub Discussions.

For feature requests, create a new GitHub Issue with the "enhancement" label after discussing it in GitHub Discussions.

## Contribution Process

To contribute to the project, follow these steps:

1. Fork the repository.
2. Create a branch with a descriptive name, using prefixes like `feature/` or `bug/` for the branch names.
3. Make your changes in the branch.
   > For server API changes, make sure to run `npm run generate-client` in the frontend folder to update the Server
   Client SDK.
   >
   > You can use the provided PyCharm run configuration `generate-client`
4. Make sure to run linters and formatters:
   - For Python code: [ruff](https://github.com/charliermarsh/ruff)
   - For TypeScript code: [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/)
5. Open a pull request to the main branch.
6. Check the CI workflow statuses and for comments on your pull request.

## Setting up a local development environment

#### Prerequisites

- Python
- Node.js
- An IDE (we suggest PyCharm, but you can use your preferred IDE)

### Create dev environment

1. Clone your fork of the Celery Insights repository.
    ```shell
    git clone https://github.com/<your_username>/celery_insights.git
    ```
2. Navigate to the root folder of the repository.
    ```shell
    cd celery_insights/
    ```
3. Install the Python dependencies using Poetry.
    ```shell
    poetry install
    ```
4. Navigate to the frontend folder.
    ```shell
    cd frontend/
    ```
5. Install the Node.js dependencies using npm.
    ```shell
    npm install
    ``` 
6. Create `.env` file
    ```shell
   cd server/
   cp .env.example .env

### Run dev server

1. Start the server (provided PyCharm run configuration `run server`)
    ```shell
   cd server/
   python run.py
   ```
2. Start the frontend server (provided PyCharm run configuration `dev`)
    ```shell
   cd frontend/
   npm run dev
   ```
3. Open browser to http://localhost:5173

## Code Styles

### General

- Write short, concise functions and classes.
- Provide detailed types and variables, including generics when needed.
- Do not abbreviate variable and function names.

### Python

- Use type annotations, including generics when required. Code should be 100% type covered.
- Avoid creating undocumented dictionaries. Use dataclasses, Pydantic models, classes, named tuples, etc.
- Avoid blocking the main thread. Use asyncio interfaces whenever possible, or use asyncio.to_thread for blocking code.
- Always log exceptions and errors. New package loggers should be added to `logging_config.py`.
- Test files should end with `_test.py`, and not start with `test_?.py`.

### TypeScript

- Use TypeScript only, avoid using vanilla JavaScript.
- Provide detailed types and variables, including generics when needed.
- Prefer arrow functions and one-liner expressions.
- Avoid storing React state multiple times. Use `useMemo` for derived states. Example:
    ```tsx
    const MyComponent: React.FC<{items: string[]}> = ({items}) => {
        // Dont
        const [lengthBad, setLength] = useState(items.length)
        useEffect(() => setLength(items.length), [items])
        
        // Do
        const lengthGood = useMemo(() => items.length, [items])
    } 
    ```
- Avoid unnecessary React re-renders. Performance is important.
- Follow the existing folder structure.

### Design Guidelines

- Users are likely to be technical, so provide full information and messages.
- Always show task avatars instead of IDs, and type colors near task types.
- Add tooltips with description and help icons where needed.
- Reactions should be near interactions; avoid toasters, popups, etc.
- Add placeholders for loading or empty containers.
- Display error inside components and provide detailed information.

## Testing

Code should be test-covered as much as possible.

Unit tests should be written close to the module they are testing, with the same module name.
For example, tests for `models.py` should be at `models_test.py` in the same folder.

Integration and end-to-end tests should be written in the tests project folder.

# License

Celery Insights is licensed under the BSD 3-Clause License.
By contributing to this project, you agree to license your contribution under the same license as the project.

# Code of Conduct

Please note that the Celery Insights project is released with a Contributor Code of Conduct. By contributing to this
project, you agree to abide by its terms. See CODE_OF_CONDUCT.md for more information.

# Contact

If you have any questions or concerns, feel free to contact @danyi1212.
