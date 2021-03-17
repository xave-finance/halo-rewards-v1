
# Contribution guidelines
:warning:  Please make sure to read all the guidelines written in this document before you start coding.

#### Table Of Contents

[Required software](#required-software)
[Coding style guidelines](#coding-style-guidelines)
[Coding standards](#coding-standards-and-best-practices)
[Recommended developer tools & configuration](#recommended-developer-tools--configuration) 
* [Code quality](#code-quality) 
* [Prettier](#Prettier) 
* [Node version locking](#node-version-locking)
* [Commit workflow](#commit-workflow)


## Required Software

You will need the following things installed in order to run the app:

- Nodejs `v8.16.2`. We **strongly** recommend you install via [NVM](https://github.com/creationix/nvm) to avoid incompatibility issues between different node projects.

```
   brew install nvm
   nvm install v8.16.2
   nvm use v8.16.2
```

- Check that the correct node (8.16.2) and npm (6.4.1) versions are installed

```
    node -v
    npm -v
```
- Hardhat - for compiling, testing and debugging smart contracts. Read their [Quick Start](https://hardhat.org/getting-started/#quick-start) for more details.
```
npm install --save-dev hardhat
```
- Metamask  
[How to install](https://metamask.io/)

## Coding Style Guidelines
Code consistency, readability and maintainability are important to us. We strictly require you to follow the specific guidelines listed below. Clean code matters!

- [Solidity](https://docs.soliditylang.org/en/v0.8.2/style-guide.html)
- [Javascript](https://www.w3schools.com/js/js_conventions.asp)
#### Notable ones are:

- Annotate your functions.
- Do not abbreviate function or variable names.
:x:  getAllocPt
:white_check_mark: getAllocationPoints
- Use descriptive words to name your variables.
- Name your functions starting with an action word followed by a noun or name of an object.
:x:  unclaimedRewards()
:white_check_mark: getUnclaimedRewards()
- Remove unused codes. Do not comment them out.
- Remove unused files.
#### Test Scripts
-   Construct a thoughtfully-worded, well-structured  describe statement.
-   Treat  `describe`  as situation or a user story.
-   Treat  `it`  as a statement about state or how an operation changes state.





## Coding Standards and Best Practices

* Code quality is enforced by [eslint](https://eslint.org/) and [prettier](https://github.com/prettier/prettier-vscode). You should set these tools up in your editor to enforce consistent code formatting across the project.
* Always apply the DRY (Don't Repeat Yourself) Principle.
* We use Gitflow as our branching model. It is recommended to [install it](https://danielkummer.github.io/git-flow-cheatsheet/) for your environment to enable helper commands. More or less, you'll usually only use `git flow feature start`, &hellip;`feature finish`, &hellip;`feature publish` and occasionally &hellip;`release start/finish/publish`.
* Ensure the appropriate git username & password is set up for this repository: `git config user.name XXXX && git config user.email XXXX`.

#### Solidity
* [Common Patterns](https://docs.soliditylang.org/en/v0.8.2/common-patterns.html)

#### React

## Recommended Developer Tools & Configuration

### Code quality

#### Prettier

You may follow base configurations for Prettier here https://github.com/prettier/prettier-vscode.

Install a plugin for your editor according to the following:

- **VSCode:** - `Prettier - Code formatter` via the marketplace (esbenp.prettier-vscode)

#### Node version locking

This project uses [`.nvmrc` files](https://github.com/creationix/nvm#nvmrc) to specify the correct nodejs versions to run when developing. You can install some additional shell hooks into [zsh on OSX](https://github.com/creationix/nvm#zsh) or place this in your `.bashrc` on Linux:

```
cd () { builtin cd "$@" && chNodeVersion; }
pushd () { builtin pushd "$@" && chNodeVersion; }
popd () { builtin popd "$@" && chNodeVersion; }
chNodeVersion() {
    if [ -f ".nvmrc" ] ; then
        nvm use;
    fi
}
chNodeVersion;
```

See submodules for further VSCode tooling such as tslint in the serverless repo and eslint in the web repo

## Commit workflow

- Commit messages should take the imperative form; ie. finish the sentence _"Applying this commit will [...]"_ 
- Make commits as atomic as possible (heavily consider using `git add -p`) 
- Use descriptive, single-line commit messages.
- All new work should be completed in feature branches until deemed stable enough for merging to `develop`.
- All new work must include unit & integration tests as appropriate to prove correct functioning of the code.
- Feature branches to be reviewed and tested by developers prior to merging into the `develop` branch. 
- After merging, ensure that the remote branch is deleted from github. Note that `git flow feature finish` automates this.
