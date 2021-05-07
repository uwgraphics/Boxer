# Boxer

Managing data for visualization using box algebra

## Requirements
* npm

## Usage


### Client

Start the client as a separate process:
```shell
cd client
npm install
npm run serve
```
Client's `npm run serve` should respond with:

    App running at:
    - Local:   http://localhost:port/
    - Network: http://ip-address:port/

Open the `Local` link in a web browser.

## GitHub Repository Contents
     client # scripts and configurations for Boxer
        └── src # source code of building Boxer
            └── components
                └── boxes # contains the source code of each view
                    ├── BandwidthAssessment.vue      
                    ├── ConfusionMatrixGrid.vue      
                    └── ...
                    


## Prerequisite
Before customizing Boxer, you might need to know the following things:

* [npm](https://docs.npmjs.com/cli/v6/commands/npm) 

* [VUE](https://vuejs.org/v2/guide/)

* [TypeScript](https://www.typescriptlang.org/docs/)


## Other Resources
* [Boxer website](https://graphics.cs.wisc.edu/Vis/Boxer/)

* [Guide for data prerparation](https://graphics.cs.wisc.edu/Vis/Boxer/docs/data_preparation/).


* [Paper link](https://arxiv.org/abs/2004.07964)

* [Online Demo](https://graphics.cs.wisc.edu/Vis/Boxer/demo/dist/index.html)
