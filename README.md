This is the "main" Boxer repo. It is taken from the "BoxerRelease" Repo in March of 2022, when the CBoxer paper was published.

This is the CODE REPOSITORY. If you want the **documentation**, see: [Boxer website](https://uwgraphics.github.io/BoxerDocs/)

This repo **deploys** as a GitHub page at: https://uwgraphics.github.io/Boxer/ which is has the alias: https://pages.graphics.cs.wisc.edu/Boxer

All **datasets** provided by this demo can be find at [public datasets repo](https://github.com/uwgraphics/BoxerData).


*For more information on the structure and implementation of Boxer, please visit the [Engineering Supplementary Documentation](./doc.md)

# Boxer

Managing data for visualization using box algebra


### Prerequisite
Before customizing Boxer, you might need to know the following things:

* [npm  (Version 6.x)](https://docs.npmjs.com/cli/v6/commands/npm) 

* [VUE](https://vuejs.org/v2/guide/)

* [TypeScript](https://www.typescriptlang.org/docs/)



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
            ├── datasets_config.json # json file of configurations of all Boxer datasets
            └── components
                └── boxes # contains the source code of each view
                    ├── BandwidthAssessment.vue      
                    ├── ConfusionMatrixGrid.vue      
                    └── ...
                    
## Add your own dataset
A dataset is represented by a directory containing the following three files:

    your_dataset
    ├── features.csv               # Contains feature values for each instance
    │                                - first column = `id`
    │
    ├── manifest.json              # Lists classes and classifiers, and describes features
    │                                - feature descriptions are used to choose data distribution views
    │                                Use the feature description format from iris/manifest.json
    │
    └── results.csv               # Contains actual class and predicted labels for each instance
                                     - first column = `id` (one-to-one mapping with `id` in features.csv)
                                     - second column = `actual` (actual class of the an instance)
                                     - further columns = labels predicted by classifiers

*More detailed information about data preparation can be found [here](https://pages.graphics.cs.wisc.edu/BoxerDocs/docs/user_guide/data_preparation/).


## FAQ

**1. If I want to make modifications on a specific view, what I should do?**

Supposed you want to make changes on the *(Overall) Performance* view, you can find the code that is used to develop this view in `client -> src -> components -> boxes -> OverallClassifierPerformance.vue`. The codes for the development of all the views can be found in the folder: `client/src/components/boxes/`.

**2. If I want to add a new view designed by my self, what I should do?**

Supposed you've already had a .vue file (e.g. SelfDefinedView.vue) that contains all components of your self-designed view, first put this file in the folder: : `client/src/components/boxes/`. Then declare the new view in `client/src/views/RigidTileHome.vue` and define the name of the view in `client/src/types.ts`. In order to make the view be correctly showed in Boxer view menu, you need to add its name in `client/src/App.vue` and `client/src/store.ts`

**3. How to set a global variable?**

All global variables are defined in `client/src/store.ts`. 

**4. How to use a global variable in each view and monitor the changes of its value?**

Since all global variables are defined in `client/src/store.ts`, you can cite this file by using *this.$store*. Supposed you'd like to use the variable "classifierThresholdDict" defined in `client/src/store.ts`, you can use *this.$store.state.classifierThresholdDict* to get its value. 

**5. How can I make changes on the top panel and right panel?**

All contents contained in the top panel are defined in `client/src/App.vue`.
All components of the right panel are included in `client/src/components/sidebar/`. 

**6. How to apply my own data into Boxer?**

Please vist the [documentation website](https://pages.graphics.cs.wisc.edu/BoxerDocs/docs/user_guide/data_preparation/) to learn more about how to apply your own dataset into Boxer.

**7. If I want to try the datasets provided in Boxer demo, what I should do?**

The datasets provided by Boxer demo can all be found in [this repo](https://github.com/uwgraphics/BoxerData). Supposed you want to try *heart disease* dataset, first open the `datasets_config.json` file. The url for *heart disease* dataset can be represented as:
*SERVER_URL* + *datasets['(continuous) heart disease'].path* = "https://raw.githubusercontent.com/uwgraphics/BoxerData/master/datasets/heart_disease/". 
Then you can use this url to load the dataset in Boxer.
