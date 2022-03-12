# Engineering Supplementary Documentation


### ML classification

In essence, after some training, a machine learning classification model takes in a piece of data and makes a prediction on how the data may be classified into given categories. Sometimes the prediction is binary (the original boxer). Other times the prediction is continuous (as in cBoxer), where the classification model outputs a  certainty level in percentage. 

Boxer (as well as cBoxer) offers a variety of visualization components that facilitates comparisons across different classifier results, so that users can understand the performance of each classifier, and potentially adopt a desired one. The system can also be used gain insights on the classifier's behavior. For instance, the user may look through the images of misclassified data points and find a certain pattern. 

For more use cases, refer to the Boxer paper. 

### Tech Stack

Boxer is build using Vue.js, a JavaScript library for building web applications. Visit their official website and other learning resources to get a basic understanding of it. Make sure you understand:

- How to define and utilize Vue states globally in store.ts and locally in components (data:{}) respectively
- Basics of Vuex and the advantages of having store.ts
- The <template> syntax
- Lifecycle methods including actions, getters, mutations, mounted, computed, watch, methods, etc.
- The Vuetify component library
- Basics of Restful API and the asynchronous `fetch()` function

	
### The Client

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

	
### GitHub Repository Contents
     client # scripts and configurations for Boxer
        └── src # source code of building Boxer
            └── components
                └── boxes # contains the source code of each view
                    ├── BandwidthAssessment.vue      
                    ├── ConfusionMatrixGrid.vue      
                    └── ...
                    
     data_converter  # python code to convert raw data to the data format that could be used by Boxer


### Data Structure

The data structures to represent our underlying dataset and the UI are defined in the types.ts file. For example, as one of the most important interfaces, `Instance` outlines the contour of the collection of data entires:  

```tsx
export interface Instance {
  actual: string; // actual value of the instance
  predictions: {[classifierName: string]: string}; // prediction results for each ML classifier 
  continuous_predictions: {}; // (for cBoxer) continuous prediction results
  left_range: {}; // (for cBoxer) left range of the threshold 
  right_range: {}; // (for cBoxer) right range of the threshold 
  features: {[featureName: string]: number | string}; // various features of the data point
}
```

	
**Data Pipeline**

The data is hosted at the backend and accessed by the frontend using a `fetch()` function. The corresponding code can be found in the `changedDataset()` function in store.ts, which fetches three files from the backend:

```tsx
const filenames = [
        'manifest.json',
        'results.csv',
        'features.csv',
      ];
```

From there, the data is parsed into an object named `parsedDataset` and stored as a global state `chosenDataSet` (yet another new name. Just bear with us). You may realize by reading the code that nearly every view visualizes Instances in some way, so it is beneficial to understand it. 

```tsx
const parsedDataset = {
          name,
          classes,
          classifiers,
          features: featureObjects,
          instances,
        };
```

If the dataset is continuous, the `updateContinuousMetrics()` function will further add the threshold and range values to the dataset.

	
### The UI

The UI can be broken down into 3 major parts, each consisting of multiple components. The organization of the code corresponds to the high-level components design (with somewhat inconsistent naming unfortunately).

- Navbar (`./left-drawer`)
    - loads datasets,
    - saves/reloads a previous workspace
    - opens new views,
    - changes grid sizes,
    - selects which classifiers to include
- Side panel (`./sidebar`)
    - sets bandwidth
    - sets boundaries for the data and classifiers (cBoxer)
        - sets threshold
        - k-fold validation
        - data mapping
    - manipulating selections and view selection history
    - data sampling (cBoxer)
- View boxes (`./boxes`)
    - the center stage of Boxer. Each view box contains a different chart for understanding and comparing classification results
    

	
**A Typical View Box**

A typical view (as a Vue component) in Boxer looks like this:

```tsx
<template>
<!-- content to be displayed -->
</template>

<script lang="ts">
import Vue from "vue";
// other module imports

export default Vue.extend({
	name: '',  // name of the view
	data(){},  // initial states local to this view
	mounted(){}, // lifecycle function (see Vue documentation)
	computed:{}, // computed values (see Vue documentation)
	watch:{}, // listener for data change. Can be configured to trigger rerender
	methods:{} // additional helper functions
})

</script>
```
	

### The variable namespace

Note that Boxer’s variable namespace contains tens of variables with sometimes unintuitive names. One way to untangle them is to start from a variable/function name, search up (with the help of your text editor) and trace its occurrences in the code. You can document the variables/functions by making a list/graph, so that you are not lost forever in the thousands of lines of code.

 

### Keep up with good code practice

1. Plan ahead before you actually code. It is always a good idea to write up some requirements, specifications, and draw up some wireframes before you dive into the code. This way, you will have a clearer mind of how to organize the functionalities
2. Be descriptive. It might be convenient to name your variables with one or two letters. But do yourself a favor by writing descriptive variable/function/class names and commenting on complex algorithms. Not only future developers but yourself will greatly appreciate this.
3. Have performance in mind. Do some research on the Vue lifecycle so you don't end up with infinite re-renders. If you dare to challenge yourself, think of applying better algorithms to reduce your time complexity. You will hit the bottleneck later than sooner as the size of the datasets gets larger. 
4. Use Vue's built-in features the way they are intended to be used. e.g. `computed` functions are intended for local computations so do not mutate states or call other computed functions inside of one; Never directly mutate props; Know where to use `commit()` and `dispatch()`; etc.
5. Choose wisely when making things global. It feels nice when you create a state in the top level store.ts file, but it gets bloated as things go down. If a state is only used in at the local component level, keep it local. 
6. Add more here!
