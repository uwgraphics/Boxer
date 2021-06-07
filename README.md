# Boxer

Managing data for visualization using box algebra

## Requirements
* npm (Version 6.x)


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
* Go to the [Boxer website](https://graphics.cs.wisc.edu/Vis/Boxer/) to learn more detailed information about Boxer system.

* If you'd like to apply your data to Boxer, check the [Guide for data prerparation](https://graphics.cs.wisc.edu/Vis/Boxer/docs/data_preparation/).


* The publications can be found [here](https://arxiv.org/abs/2004.07964)

* Try Boxer via the [Online Demo](https://graphics.cs.wisc.edu/Vis/Boxer/demo/dist/index.html)


## FAQ

*1. If I want to make modifications on a specific view, what I should do?*

Supposed you want to make changes on the **(Overall) Performance** view, you can find the code that is used to develop this view in `client -> src -> components -> boxes -> OverallClassifierPerformance.vue`. The codes for the development of all the views can be found in the folder: `client/src/components/boxes/`.

*2. If I want to add a new view designed by my self, what I should do?*

Supposed you've already had a .vue file (e.g. SelfDefinedView.vue) that contains all components of your self-designed view, first put this file in the folder: : `client/src/components/boxes/`. Then declare the new view in `client/src/views/RigidTileHome.vue` and define the name of the view in `client/src/types.ts`. In order to make the view be correctly showed in Boxer view menu, you need to add its name in `client/src/App.vue` and `client/src/store.ts`

*3. How to set a global variable?*

All global variables are defined in `client/src/store.ts`. 

*4. How to use a global variable in each view and monitor the changes of its value?*

Since all global variables are defined in `client/src/store.ts`, you can cite this file by using **this.$store**. Supposed you'd like to use the variable "classifierThresholdDict" defined in `client/src/store.ts`, you can use **this.$store.state.classifierThresholdDict** to get its value. 

*5. How can I make changes on the top panel and right panel?*

All contents contained in the top panel are defined in `client/src/App.vue`.
All components of the right panel are included in `client/src/components/sidebar/`. 

*6. How to apply my own data into Boxer?*

Please vist the [documentation website](https://graphics.cs.wisc.edu/Vis/Boxer/docs/data_preparation/) to learn more about how to apply your own dataset into Boxer.

*7. If I want to try the datasets provided in Boxer demo, what I should do?*

The datasets provided by Boxer demo can all be found in [this repo](https://github.com/uwgraphics/BoxerData). Supposed you want to try **heart disease** dataset, first open the `datasets_config.json` file. The url for **heart disease** dataset can be represented as **SERVER_URL** + **datasets['(continuous) heart disease'].path** = "https://raw.githubusercontent.com/uwgraphics/BoxerData/master/datasets/heart_disease/". Then you can use this url to load the dataset in Boxer.
