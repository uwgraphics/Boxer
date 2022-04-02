import Vue from 'vue';
import Vuex from 'vuex';
import * as d3 from 'd3';
import {
  modelSelectionRecord,
  EntityType,
  Feature,
  Instance,
  Metrics,
  SelectionAction,
  SelectionRecord,
  SelectionStrategy,
  Visualization,
  VisualizationType,
  ThresholdWithClassifier,
  thresholdSelectionRecord,
} from './types';
import {
  difference,
  intersection,
  instanceById,
  xor,
  union,
} from './utils';
import {
  predicateAbstraction, isConstraintComplete, composePredicates,
} from './components/constraints/utils';
import { range, select, selection } from 'd3';

import { colors } from './theme';

const fs = require('browserify-fs');

Vue.use(Vuex);

const config = require("./datasets_config.json");

const datasets: {
} = config.datasets;

const SERVER_URL =  config.SERVER_URL;

export default new Vuex.Store({
  state: {
    saveStatus:0,
    resumeStatus:0,
    saveConfig:{
      "Reliability_Curve":[],
      "Histogram":[],
      "Performance_Curves":[],
      "Trinary_Bandwidth_Assessment":[],
      "Rejected_Curve":[],
      "UncertaintyHeatMap":[],
      "Trinary_Performance_Confidence":[],
      "Trinary_Instance_Distribuion":[],
      "Thresholds":{},
      "Bandwidths":{},
    },
    resumedBandwidths:{},
    viewsConfig: [],
    chosenFixedDataset: {},
    fixedDataset: 'yes',
    corsError: '',
    currentChosenSample: '',
    weightMode: 'no',
    currentChosenFold:'',
    sampleList: [],
    sampleDict: {},
    selectedSampleSet: {
      first: null as SelectionRecord | null,
      second: null as SelectionRecord | null,
    },
    validationList: [],
    addedThresholdClassifiers: [],
    curAddedThresholdClassifier: {},
    addedBandWidthClassifiers: [],
    withinClassifierBandWidthList: [],
    withinClassifierName: '',
    classifierBandWidthDict: {},
    bandWidthChangedClassifierName:'',
    outerBandWidth:{},
    classifierThresholdList:[],
    classifierThresholdDict:{},
    thresholdClassifierNameList:[],
    chosenClassifierThresholdTuple: {
      classifier: "",
      single_threshold: 0,
    } as ThresholdWithClassifier,
    curveChosenClassifierThresholdTuple:{
      classifier:"",
      single_threshold: 0,
    } as ThresholdWithClassifier,
    datasetType: 'discrete' as 'discrete' | 'continuous',
    viewWidth: "50%",
    baseDataset: 'both' as 'both' | 'train' | 'test' | 'sample',
    baseSelection: {
      description: 'Not yet set',
      id: -1,
      instances: new Set(),
      name: 'Not yet set',
      classifier:"null",
      className:"null",
      weight:0,
    } as SelectionRecord,
    chosenDataset: {
      name: '',
      classes: [],
      classifiers: [],
      features: {},
      instances: {},
    } as {
      name: string,
      classes: string[],
      classifiers: string[],
      features: { [id: string]: Feature },
      instances: { [id: string]: Instance },
    },
    datasets,
    hoverInstance: '',
    continuous_metrics:{},
    weighted_metrics: {},
    filters: {
      class: {
        type: SelectionAction.Exclude,
        set: new Set(),
      },
      classifier: {
        type: SelectionAction.Exclude,
        set: new Set(),
      },
      instance: {
        type: SelectionAction.Exclude,
        set: new Set(),
      },
    } as {
      [key in EntityType]: {
        type: SelectionAction,
        set: Set<string>,
      }
    },
    overlapSelections: {
      first: null as SelectionRecord | null,
      second: null as SelectionRecord | null,
    },
    selectionHistory: [] as SelectionRecord[],

    focusItemId: null as string,
    focusSet: null as string,
    focusDotEmphasis: false,

    modelSelections: null as modelSelectionRecord | null,
    modelSelectionHistory: [] as modelSelectionRecord[],
    selectionStrategy: SelectionStrategy.Any as SelectionStrategy,
    views: {
      all: [
        VisualizationType.CA,
        VisualizationType.SCP,
        VisualizationType.COV,
        VisualizationType.CMG,
        VisualizationType.FH,
        VisualizationType.UM,
        VisualizationType.OCA,
        VisualizationType.PCC,
        VisualizationType.SM,
        VisualizationType.SMP,
        VisualizationType.ITL,
        VisualizationType.SP,
        VisualizationType.FI
      ],
      open: [
        VisualizationType.CA,
        VisualizationType.FH,
      ],
    } as {
      all: VisualizationType[],
      open: VisualizationType[],
    },
    intersectionMode: true,
  },
  mutations: {
    setSavesStatus(state, new_status){
      Vue.set(state, 'saveStatus', new_status)
    },
    setResumeStatus(state, new_status) {
      Vue.set(state, 'resumeStatus', new_status)
    },
    setSaveConfig(state, config){
      Vue.set(state.saveConfig, config['name'], config['config'])
    },
    setChosenFixedDataset(dataset, new_dataset) {
      Vue.set(dataset, 'chosenFixedDataset', new_dataset);
    },
    setFixedDataset(flag, new_flag) {
      Vue.set(flag, 'fixedDataset', new_flag)
    },
    setcorsError(cors_error, new_error) {
      Vue.set(cors_error, 'corsError', new_error)
    },
    setContinuousMetrics(continuous_metrics, new_metrics) {
      Vue.set(continuous_metrics, "continuous_metrics", new_metrics)
    },
    setWeightMetrics(metrics, new_metrics) {
      Vue.set(metrics, "weighted_metrics", new_metrics)
    },
    setCurveChosenClassifierThresholdTuple(continuous_classifierThreshold, new_classifierThreshold) {
      Vue.set(continuous_classifierThreshold, "curveChosenClassifierThresholdTuple", new_classifierThreshold)
    },
    setChosenClassifierThresholdTuple(continuous_classifierThreshold, new_classifierThreshold) {
      Vue.set(continuous_classifierThreshold, "chosenClassifierThresholdTuple", new_classifierThreshold)
    },
    setWeightMode(state, new_mode) {
      Vue.set(state, "weightMode", new_mode)
    },
    setclassifierBandWidthDict(state, newUncertainBandwidth){
      Vue.set(state, "classifierBandWidthDict",newUncertainBandwidth);
    }, 
    setWithinClassifierBandWidthList(state, newWithinClassifier) {
      Vue.set(state, "withinClassifierBandWidthList", newWithinClassifier);
    },
    setWithinClassifierName(state, newClassifierName) {
      Vue.set(state, 'withinClassifierName', newClassifierName)
    },
    setBandWidthChangedClassifier(state, newuncertainClassifier){
      Vue.set(state, "bandWidthChangedClassifierName",newuncertainClassifier);
    },
    setouterBandWidth(state, new_bandWidth){
      Vue.set(state, "outerBandWidth", new_bandWidth);
    },
    setClassifierThresholdDict(state, new_allclassifierThreshold) {
      Vue.set(state, 'classifierThresholdDict', new_allclassifierThreshold);
    },
    setThresholdClassifierNameList(state, new_allthresholdClassifiers) {
      Vue.set(state, "thresholdClassifierNameList",new_allthresholdClassifiers)
    },
    setResumedBandwidths(state, new_bands){
      Vue.set(state, "resumedBandwidths",new_bands)
    },
    setViewsType (state, views: VisualizationType[]) {
      Vue.set(state.views, 'all',views)
    },
    setTileWidth(state, width) {
      Vue.set(state, "viewWidth", width);
    },
    setToggleIntersectionMode(state, intersect) {
      Vue.set(state, 'intersectionMode', intersect);
    },
    setBaseSelection(state, baseSelection: SelectionRecord) {
      Vue.set(state, 'baseSelection', baseSelection);
    },
    setOpenViews(state, views: VisualizationType[]) {
      Vue.set(state.views, 'open', views);
    },
    setViewsConfig(state,  new_config) {
      Vue.set(state, 'viewsConfig', new_config)
    },
    setOverlapSelection(
      state,
      payload: {
        whichOverlap: 'first' | 'second',
        selection: SelectionRecord | null,
      },
    ) {
      const {whichOverlap, selection} = payload;
      const newOverlapSelections = Object.assign({}, state.overlapSelections);
      newOverlapSelections[whichOverlap] = selection;
      Vue.set(state, 'overlapSelections', newOverlapSelections);
      console.log(`Set ${whichOverlap} selection set to`, state.overlapSelections[whichOverlap]);
    },
    setSampleSelection(
      state,
      payload: {
        whichOverlap: 'first' | 'second',
        selection: SelectionRecord | null,
      },
    ) {
      const {whichOverlap, selection} = payload;
      const newOverlapSelections = Object.assign({}, state.selectedSampleSet);
      newOverlapSelections[whichOverlap] = selection;
      Vue.set(state, 'selectedSampleSet', newOverlapSelections);
    },
    setSampledList(state, sampleList) {
      Vue.set(state, 'sampleList', sampleList);
    },
    setValidationdList(state, validationList) {
      Vue.set(state, 'validationList', validationList);
    },
    setCurrentChosenSample(state, currentChosenSample) {
      Vue.set(state, 'currentChosenSample',currentChosenSample);
    },
    setCurrentChosenFold(state, currentChosenFold) {
      Vue.set(state, 'currentChosenFold', currentChosenFold);
    },
    setSampleData(
      state,
      payload: {
        selection:  null,
        whichOverlap: 'first' | 'second',
      }
    ) {
      const tmpSample = payload.selection;
      Vue.set(state, 'sampleDict', tmpSample);
      Vue.set(state, 'baseDataset', 'sample');
    },
    setSelectionHistory(state, newHistory) {
      Vue.set(state, 'selectionHistory', newHistory);
      const predicate = state.selectionHistory[0].predicate;
      if (predicate) {
        predicateAbstraction(predicate);
      }
    },
    setAddedThresholdClassifiers(state, newAddedThresholdClassifiers) {
      Vue.set(state, 'addedThresholdClassifiers', newAddedThresholdClassifiers);
    },
    setAddedBandWidthClassifiers(state, newAddedBandWidthClassifiers) {
      Vue.set(state, 'addedBandWidthClassifiers', newAddedBandWidthClassifiers)
    },
    setCurAddedThresholdClassifier(state, newCurAddedThresholdClassifier) {
      Vue.set(state, 'curAddedThresholdClassifier', newCurAddedThresholdClassifier)
    },
    mutateFocusItem(state, id){
      Vue.set(state, 'focusItemId', id)
    },
    mutateFocusSet(state, id){
      Vue.set(state, 'focusSet', id)
    },
    setEmphasis(state, status){
      Vue.set(state,'focusDotEmphasis', status)
    },
    setAddedClassifier(state, newAddedClassifier) {
      Vue.set(state, 'addedClassifier', newAddedClassifier);
    }, 
    setAdditionalClassifiers(state, newAdditionalClassifiers) {
      Vue.set(state, 'additionalClassifiers', newAdditionalClassifiers);
    },
    setModelSelection(
      state,
      payload:{
        selection: modelSelectionRecord | null,
      },
     ){
       const {selection} = payload;
       Vue.set(state, 'modelSelections',selection );
    },
    setChosenDataset(state, newDataset) {
      Vue.set(state, 'chosenDataset', newDataset);
    },
    setHoverInstance(state, id) {
      Vue.set(state, 'hoverInstance', id);
    },
    setFilter(
      state,
      payload: {
        entityType: EntityType,
        newFilter: {
          type: SelectionAction,
          set: Set<string>,
        },
      },
    ) {
      Vue.set(state.filters, payload.entityType, payload.newFilter);
    },
  },
  actions: {
    resumeViews(context) {
      const views_recommendation = this.state.chosenFixedDataset['views_recommendation'].map((c)=>c.name).filter((c)=>c!="Bandwidths"&&c!="Thresholds");
      context.commit('setOpenViews', views_recommendation);
      const thresholds = this.state.chosenFixedDataset['views_recommendation'].filter((c)=>c.name=="Thresholds");
      const bandwidths = this.state.chosenFixedDataset['views_recommendation'].filter((c)=>c.name=="Bandwidths");

      if (thresholds.length > 0) {
        let tmp  = {}
        let classifiers = Object.keys(context.state.classifierThresholdDict)
        classifiers.forEach((c)=>{
          if (Object.keys(thresholds[0].config).includes(c) && c!="") {
            tmp[c]  = thresholds[0].config[c]
          }
        })
        context.commit('setClassifierThresholdDict',tmp)
      }
      if (bandwidths.length > 0) {
        let resumedBandwidths = {}
        Object.keys(this.getters.classifierThresholdDict).forEach((c)=>{
          if (c != "") {
            let left_range = parseFloat((bandwidths[0].config[c].split("-")[0]))
            let right_range = parseFloat((bandwidths[0].config[c].split("-")[1]))
            resumedBandwidths[c] = {
              "left_range":left_range, "right_range":right_range
            }
          }
        })
        
        context.commit('setResumedBandwidths',resumedBandwidths)
      }
      context.commit('setViewsConfig', this.state.chosenFixedDataset['views_recommendation'])
      context.commit('setResumeStatus', context.state.resumeStatus+1)
    },
    changedSaveConfig(context, new_config) {
      context.commit("setSaveConfig", new_config)
    },
    reloadViews(context) {
      const filePath = "views_config.json";
      setTimeout(()=>{
        fs.readFile(filePath, 'utf-8', function(err, data) {
          let config = JSON.parse(data)
          const views_recommendation = config['views_recommendation'].map((c)=>c.name).filter((c)=>c!="Bandwidths"&&c!="Thresholds");
          context.commit('setOpenViews', views_recommendation);
          const thresholds = config['views_recommendation'].filter((c)=>c.name=="Thresholds");
          const bandwidths = config['views_recommendation'].filter((c)=>c.name=="Bandwidths");
          const selections = config['views_recommendation'].filter((c)=>c.name=="Selections");
          
          selections[0]["config"]["instances"] = new Set(selections[0]["config"]["instances"])
          context.dispatch('prependToSelectionHistory', selections[0].config);
          context.dispatch('changedMostRecentSelection', "first");


          if (thresholds.length > 0) {
            context.commit('setClassifierThresholdDict',thresholds[0].config)
          }
          if (bandwidths.length > 0) {
            let resumedBandwidths = {}
            Object.keys(context.state.classifierThresholdDict).forEach((c)=>{
              let left_range = parseFloat((bandwidths[0].config[c].split("-")[0]))
              let right_range = parseFloat((bandwidths[0].config[c].split("-")[1]))
              resumedBandwidths[c] = {
                "left_range":left_range, "right_range":right_range
              }
            })
            context.commit('setResumedBandwidths',resumedBandwidths)
          }
          context.commit('setViewsConfig', config['views_recommendation'])
          context.commit('setResumeStatus', context.state.resumeStatus+1)
        });
        
      },1000)
    },
    saveViews(context) {
      context.commit("setSavesStatus", context.state.saveStatus+1)
    },
    wrtieConfig(context) {
      const filePath = "views_config.json";
      setTimeout(() => {
        const openViews = context.state.views.open;
        const checkedViews = Object.keys(context.state.saveConfig);
        let config = { "views_recommendation":[]}
        openViews.forEach((c)=>{
          if (c.toString() != 'Selections') {
            if (checkedViews.includes((c))) {
              config["views_recommendation"].push({"name":c,"config":context.state.saveConfig[c]})
            } else {
              config["views_recommendation"].push({"name":c})
            }
          }
        })
        let selections = {}
        for (let key in context.state.selectionHistory[0]) {
          if (key == 'instances') {
            selections[key] = [...context.state.selectionHistory[0][key]]
          } else {
            selections[key] = context.state.selectionHistory[0][key]
          }
        }
        config["views_recommendation"].push({"name":"Selections","config":selections})
        if (context.state.datasetType ==  'continuous') {
          config["views_recommendation"].push({"name":"Thresholds", "config":context.state.classifierThresholdDict})
          let bandwidths = {}
          let classifierThresholdDict = context.state.classifierThresholdDict
          Object.keys(classifierThresholdDict).forEach((c)=>{
            bandwidths[c] = (this.getters.continuous_metrics[c].cur_left_edge).toFixed(2) + '-' + (this.getters.continuous_metrics[c].cur_right_edge).toFixed(2)
          })
          config["views_recommendation"].push({"name":"Bandwidths", "config":bandwidths})
        }
        const fileContent = JSON.stringify(config);
        fs.writeFile(filePath, fileContent, function() {});
      }, 1000);
    },
    drawSelections(context, selection_attribute) {
      const barCells = selection_attribute.barCells;
      const x = selection_attribute.x;
      const y = selection_attribute.y;
      const width = selection_attribute.width;
      const height = selection_attribute.height;
      const r  = selection_attribute.r;
      const color = selection_attribute.color;

      const circle_visibility = selection_attribute.circle_visibility;
      const cx = selection_attribute.cx;
      const cy = selection_attribute.cy;
      const selection_type = selection_attribute.selection_type;
      const focused = selection_attribute.focused;


      barCells.append('rect')
        .attr('class','selection-rect-'+selection_type)
        .attr('x', x)
        .attr('y', y)
        .attr('width', width)
        .attr('height',height)
        .attr('fill', color)
        .attr('stroke', 'black')
        .attr('stroke-width', '2px')
        .attr('pointer-events', 'none')

      barCells.append("circle")   
        .attr('class', 'selection-circle-'+selection_type)
        .attr('cx', cx )
        .attr('cy', cy)
        .attr('r', r)
        .style('fill', color)
        .attr('stroke', 'grey')
        .attr("visibility", circle_visibility) 
      
      // focus dot
      barCells.append('circle')
          .attr('class','selection-focus-'+selection_type)
          .attr('cx', cx)
          .attr('cy', y + height/2)
          .attr('r', this.state.focusDotEmphasis ? r*3 :r/1.5)
          .style('fill', colors.focus)  
          .attr('stroke', 'black')  
          .attr('stroke-width', 3)
          .attr("visibility", focused?"visible":"hidden")

    },  
    blinkFocus(context){
      context.commit('setEmphasis', true)
      setTimeout(() => {
        context.commit('setEmphasis', false)
      }, 1000);
    },
    emphasizeFocus(context){
      context.commit('setEmphasis', !this.state.focusDotEmphasis)
    },
    changedcorsError(context, new_cors_error) {
      context.commit('setcorsError', new_cors_error);
    },
    changedToSamplingData(
      context,
      payload: {
        selection: null,
        whichOverlap: 'first' | 'second',
      },
    ) {
      context.commit('setSampleData', payload);
      context.dispatch('changedContinuousMetrics');
      context.dispatch('updateContinuousMetrics');
    },
    changedSampledList(context, new_sample_value) {
      context.commit("setSampledList",new_sample_value)
    },
    changedValidationList(context, new_validation) {
      context.commit("setValidationdList",new_validation)
    },
    changeCurrentChosenSample(context, new_chosen_sample){
      context.commit("setCurrentChosenSample", new_chosen_sample);
    },
    changedCurrentChosenFold(context, new_chosen_fold) {
      context.commit("setCurrentChosenFold", new_chosen_fold)
      context.dispatch("changedContinuousMetrics")
      context.dispatch('updateWeightedMetrics')
    },
    changedDataType(context, new_data_type) {
      context.commit("setDataType",new_data_type)
    },
    changedAddedThresholdClassifiers (context, value) {
      context.commit('setAddedThresholdClassifiers', value);
      context.dispatch('updateContinuousMetrics');
    },
    changedAddedBandWidthClassifiers(context, value) {
      context.commit('setAddedBandWidthClassifiers',value);
    },
    changedOuterBandWidth(context, value) {
      context.commit('setouterBandWidth', value);
    },  
    changedCurAddedThresholdClassifier(context, value) {
      context.commit('setCurAddedThresholdClassifier', value)
    },
    changedclassifierBandWidthDict(context, uncertainBandwidth) {
      context.commit("setclassifierBandWidthDict",uncertainBandwidth);
      context.dispatch("updateContinuousMetrics")
    },
    changedWithinClassifierBandWidthList(context, withinClassifierBandWidthList) {
      context.commit("setWithinClassifierBandWidthList", withinClassifierBandWidthList);
    },
    changedWithinClassifierName(context, withinClassifierName) {
      context.commit("setWithinClassifierName", withinClassifierName);
    },  
    changedBandWidthClassifier(context, bandWidthChangedClassifierName) {
      context.commit("setBandWidthChangedClassifier",bandWidthChangedClassifierName);
    },
    changedCurveChosenClassifierThresholdTuple(context, classifierThreshold) {
      context.commit("setCurveChosenClassifierThresholdTuple",classifierThreshold);
      context.commit("setChosenClassifierThresholdTuple",classifierThreshold);
      context.dispatch('changedDatasetContinuous');
    },
    changedContinuousThreshold(context,classifierThreshold) {
      context.commit("setChosenClassifierThresholdTuple",classifierThreshold);
      context.dispatch('changedDatasetContinuous');
    },
    changedGridSize(context) {
      if (context.state.viewWidth === "50%") {
        context.commit("setTileWidth", "" + (100 / 3) + "%");
      } else {
        context.commit("setTileWidth", "50%");
      }
    },
    changedToggleShift(context, keyEvent) {
      if (keyEvent.key === 'Shift') {
        context.commit('setToggleIntersectionMode', keyEvent.type === 'keyup');
      }
    },
    changedSampleSelection(
      context,
      payload: {
        selection: SelectionRecord | null,
        whichOverlap: 'first' | 'second',
      },
    ) {
      context.commit('setSampleSelection', payload)
    },
    changedOverlapSelection(
      context,
      payload: {
        selection: SelectionRecord | null,
        whichOverlap: 'first' | 'second',
      },
    ) {
      context.commit('setOverlapSelection', payload);
    },
    clearHoverInstance(context) {
      context.commit('setHoverInstance', '');
    }, 
    openView(context, view: VisualizationType) {
      const pastViews = context.state.views.open;
      const newViews = [...pastViews, view];
      context.commit('setOpenViews', newViews);
    },
    closeView(context, index: number) {
      const pastViews = context.state.views.open;
      const newViews = pastViews.filter((view, i) => i !== index);
      context.commit('setOpenViews', newViews);
    },
    loadFirstDataset(context) {
      const datasetList = Object.keys(context.state.datasets);
      if (datasetList.length === 0) {
        console.error('Vuex state.datasets is empty. Cannot load first dataset.');
        return;
      }
      const firstDataset = datasetList[0];
      context.dispatch('changedDatasetByName', firstDataset);
    },
    prependToSelectionHistory(context, payload) {
      console.log(payload)
      if (context.state.intersectionMode || context.state.selectionHistory.length < 2) {
        const oldSelectionHistory = context.state.selectionHistory;
        const selection: SelectionRecord = {
          description: payload.description,
          id: oldSelectionHistory.length,
          instances: payload.instances,
          name: 'No name',
          weight: 0
        };
        if (payload.predicate) {
          selection.predicate = payload.predicate;
        }
        const newSelectionHistory = [selection, ...oldSelectionHistory];
        context.commit('setSelectionHistory', newSelectionHistory);
      } else {
        console.log("UNION MODE");
        const oldSelectionHistory = context.state.selectionHistory;
        const lastSelection = context.state.selectionHistory[0];
        let instances = new Set([...lastSelection.instances, ...payload.instances]);
        let unionDescription = "union(" + lastSelection.id + ", " + payload.description + ")";
        const selection: SelectionRecord = {
          description: unionDescription,
          id: oldSelectionHistory.length,
          instances: instances,
          name: 'No name',
          weight:0
        };
        if (payload.predicate && lastSelection.predicate) {
          selection.predicate = composePredicates(payload.predicate, lastSelection.predicate, "union");
        }
        const newSelectionHistory = [selection, ...oldSelectionHistory];
        context.commit('setSelectionHistory', newSelectionHistory);
      }
    },
    resetSelectionHistory(context) {
      const trainOrTest = 'train_or_test';
      const cleanSelectionHistory: SelectionRecord[] = [
        {
          id: 0,
          name: 'Original',
          description: 'Original dataset',
          instances: new Set(Object.keys(context.state.chosenDataset.instances)),
          weight:0
        },
        
      ];
      context.commit('setSelectionHistory', cleanSelectionHistory);
      if (context.state.datasetType == 'continuous') {
        context.dispatch('updateWeightedMetrics')
      }
      const baseSelection = cleanSelectionHistory[0];
      context.commit('setBaseSelection', baseSelection);
      context.commit('setOverlapSelection', { whichOverlap: 'first', selection: null });
      context.commit('setOverlapSelection', { whichOverlap: 'second', selection: null });
    },
    changedBaseSelection(context, baseSelection: SelectionRecord) {
      context.commit('setBaseSelection', baseSelection);
    },
    changedDatasetByName(context, datasetName: string) {
      const datasetList = Object.keys(context.state.datasets);
      const chosenDataset = datasetList.indexOf(datasetName);
      if (chosenDataset === -1) {
        console.error(`Dataset named ${datasetName} not found in state.datasets`);
        return;
      }
      const datasetPath = SERVER_URL + datasets[datasetName].path;
      context.commit("setChosenFixedDataset", datasets[datasetName])
      context.commit("setClassifierThresholdDict",{});
      context.commit("setThresholdClassifierNameList",[]);
      context.dispatch('changedDataset', datasetPath);
    },
    changedDataset(context, datasetURL: string) {
      if (datasetURL.substring(0, SERVER_URL.length) == SERVER_URL) {
        context.commit('setFixedDataset','yes')
      } else {
        context.commit('setFixedDataset','no')
      }
      let datasetPath = datasetURL.endsWith("/") ? datasetURL : datasetURL + "/";
      const filenames = [
        'manifest.json',
        'results.csv',
        'features.csv',
      ];
      Promise.all(filenames.map((filename) => {
        const url = datasetPath + filename;
        const fileType = filename.split('.').pop();
        return fetch(url)
          .then((response) => {
            if (!response.ok) {
              return Promise.reject(response.status);
            }
            return response.text();
          })
          .then((data) => {
            switch (fileType) {
              case 'csv':
                return d3.csvParse(data);
              case 'json':
                return JSON.parse(data);
              default:
                return data;
            }
          })
          .catch(error => {                  
            console.log("Catch Error, check CORS extension")
            context.dispatch("changedcorsError", "error")
          });
      })).then((data) => {
        let [manifest, resultsData, featuresData] = data;         
        const checkData = () => {
          const ManifestResultsClassifier = () => {
            const mClassifiers = new Set(manifest.classifiers);
            const rCLassifiers = new Set(resultsData.columns.filter((x: string) => !['id', 'actual'].includes(x)));
            const mismatch = xor(mClassifiers, rCLassifiers);
            if (mismatch.size > 0) {
              console.error('Mismatch in classifiers from manifest and classifiers in results.csv columns headers.');
            }
          };
          ManifestResultsClassifier();

          const resultsFeaturesRows = () => {
            if (resultsData.length !== featuresData.length) {
              console.error('Number of rows in features and results is not equal.');
            }
          };
          resultsFeaturesRows();

          const resultsMissingValues = () => {
            const rData: Array<{[key: string]: any}> = resultsData;
            Object.values(rData).forEach((r) => {
              Object.values(r).forEach((cellString: string) => {
                if (cellString === '') {
                  console.error('Empty cell in results.csv');
                }
              });
            });
          };
          resultsMissingValues();
        };
        checkData();

        const pathPieces = datasetPath.split('/');
        const name = pathPieces[pathPieces.length - 2];
        const classes: string[] = manifest.classes.map((c: any) => c.toString());
        const classifiers: string[] = manifest.classifiers.map((c: any) => c.toString());
        const featureNames: string[] = Object.keys(manifest.features).filter((f) => f !== 'id');

        if (featureNames.includes('texts')) {
          let tmp_features = []
          featuresData.forEach((f)=>{
            f['texts-length'] = f['texts'].length
            tmp_features.push(f)
          })
          featuresData = tmp_features
          manifest['features']['texts-length'] = {
            'description': "text length",
            'type': "ratio"
          }
        }

        const instancesList = resultsData.map((i)=>i[classifiers[0]])
        const uniqueList =  instancesList.filter(function(item, pos) {
            return instancesList.indexOf(item) == pos;
        })
        
        // record the views.all
        this.state.views.all = [
          VisualizationType.FI,
          VisualizationType.CA,
          VisualizationType.SCP,
          VisualizationType.COV,
          VisualizationType.CMG,
          VisualizationType.FH,
          VisualizationType.OCA,
          VisualizationType.PCC,
          VisualizationType.SP,
          VisualizationType.SM,
          VisualizationType.SMP,
          VisualizationType.ITL,
        ]
        // judge the data type automatically
        this.state.datasetType = 'discrete'
        if (uniqueList.length > classes.length) {
          this.state.datasetType = 'continuous'
          this.state.views.all = [
            VisualizationType.FI,
            VisualizationType.CA,
            VisualizationType.SCP,
            VisualizationType.CC,
            VisualizationType.RC,
            VisualizationType.CB,
            VisualizationType.BA,
            VisualizationType.REC,
            VisualizationType.TID,
            VisualizationType.UM,
            VisualizationType.CMG,
            VisualizationType.FH,
            VisualizationType.OCA,
            VisualizationType.PCC,
            VisualizationType.SP,
            VisualizationType.SM,
            VisualizationType.SMP,
            VisualizationType.ITL
          ]
        } 
      
        const instances: {[id: string]: Instance} = {};
        resultsData.forEach((
          result: {
            id: string,
            actual: string,
            [classifier: string]: string,
          },
          index: number,
        ) => {
          const continuous_predictions = {};
          const left_range = {};
          const right_range = {};
          classifiers.forEach((c)=>{
              continuous_predictions[c] = parseFloat(result[c]).toFixed(3) + ""
              left_range[c] = 0.05
              right_range[c] = 0.05
          })
          // if in continuous mode, get the specific class according to the threshold
          if (this.state.datasetType == "continuous") {
            let tmp_thresholdsClassifier = []
            classifiers.forEach((c)=>{
              tmp_thresholdsClassifier.push(c+"_"+"50")
            })
            context.commit("setThresholdClassifierNameList",tmp_thresholdsClassifier);

            let tmp_classifierThresholds = {}
            classifiers.forEach((c)=>{
              tmp_classifierThresholds[c] = 50
            })
            context.commit("setClassifierThresholdDict",tmp_classifierThresholds);
            classifiers.forEach((c)=>{
              if (parseFloat(result[c]) < this.state.classifierThresholdDict[c] / 100) {
                result[c] = classes[0]
              } else {
                result[c] = classes[1]
              }
            })
            
            // also record the saved thresholdClassifier
            this.state.thresholdClassifierNameList.forEach((c)=>{
              let splitL = c.split("_")
              let classifier =c.substring(0,c.length-splitL[splitL.length-1].length-1)
              let threshold = parseFloat(splitL[splitL.length-1])
              if (parseFloat(continuous_predictions[classifier]) < threshold / 100) {
                result[c] = classes[0]
              } else {
                result[c] = classes[1]
              }
            })
          }
          
          
          const {id: rId, actual, ...predictions} = result;
          const {id: fId, ...features} = featuresData[index];
          if (rId !== fId) {
            console.error('Ids in results.csv and features.csv do not match.',rId,fId);
            return;
          }
          instances[index] = {
            actual,
            predictions,
            continuous_predictions,
            left_range,
            right_range,
            features,
          };
        });

        const addRandomClassifier = () => {
          const randomClassifier = 'Random Classifier';
          classifiers.unshift(randomClassifier);
          Object.values(instances).forEach((i) => {
            const randomClass = classes[Math.floor(Math.random() * classes.length)];
            i.predictions[randomClassifier] = randomClass;
          });
        };
        addRandomClassifier();

        const addMajorityClassifier = () => {
          const majorityClassifier = 'Majority Classifier';
          classifiers.unshift(majorityClassifier);
          const classCounts: { [className: string]: number } = {};
          classes.forEach((className) => classCounts[className] = 0);
          Object.values(instances).forEach((i) => classCounts[i.actual]++);
          let majorityClass = Object.keys(classCounts)[0];
          Object.keys(classCounts).forEach((className) => {
            if (classCounts[className] > classCounts[majorityClass]) {
              majorityClass = className;
            }
          });
          Object.values(instances).forEach((id) => id.predictions[majorityClassifier] = majorityClass);
        };
        addMajorityClassifier();

        const addOracle = () => {
          const oracle = 'Oracle';
          classifiers.unshift(oracle);
          Object.values(instances).forEach((i) => i.predictions[oracle] = i.actual);
        };
        addOracle();

        const featureObjects: {
          [name: string]: Feature;
        } = manifest.features;
        const testFeatureObjects = () => {
          const allowedTypes = [
            'categorical',
            'interval',
            'nominal',
            'ordinal',
            'ratio',
          ];
          Object.keys(featureObjects).forEach((featureName: string) => {
            const f = featureObjects[featureName];
            if (!f.description) {
              console.error(`Feature ${featureName} has no description.`);
            }
            if (!allowedTypes.includes(f.type)) {
              console.error(`Feature ${featureName} does not have a valid type. It has type "${f.type}" instead`);
            }
          });
        };
        testFeatureObjects();

        const parsedDataset = {
          name,
          classes,
          classifiers,
          features: featureObjects,
          instances,
        };
        if (Object.keys(featureObjects).includes('train_or_test')) {
          context.state.baseDataset = 'test';
        } else {
          context.state.baseDataset = 'both';
        }
        if(Object.keys(context.state.sampleDict).length != 0 ) {
          context.state.baseDataset = 'sample';
        }

        context.commit('setChosenDataset', parsedDataset);
        context.dispatch('resetSelectionHistory');


        if (this.state.datasetType == 'continuous') {
          context.dispatch("changedContinuousMetrics");
        }

      });
    },
    updateWeightedMode(context) {
      context.commit("setWeightMode",'no');
    },
    updateWeightedMetrics(context) {
      context.commit("setWeightMode",'yes');

      const selectionHistory  = this.state.selectionHistory;
      const instances: string[] = [...this.getters.filteredInstances];
      const dummyClassifiers = [
        'Oracle',
        'Majority Classifier',
        'Random Classifier',
      ];
      const classifiers: string[] = ([...this.getters.filteredClassifiers])
      const preContinuousMetrics = this.getters.continuous_metrics;

      if (Object.keys(preContinuousMetrics).length == 0) {
        return
      }

      let instant_variables = ['x_roc', 'y_roc', 'value_roc', 'x_pr', 'y_pr', 'line_roc', 'line_pr', 'auc_area', 'acc', 
            'cur_threshold', 'cur_uncertain', 'cur_left_edge', 'cur_right_edge',
            'tp_instances','fp_instances','tn_instances','fn_instances', 'm_tp_instances', 'm_tn_instances', 'm_fp_instances', 'm_fn_instances', 'ins_per' ]
      let changed_variables = ['tp','fp','tn','fn', 'm_tp', 'm_tn', 'm_fp', 'm_fn',  
      'accuracy', 'mcc', 'precision', 'recall', 'f1']  
      let changed_instances_set : string[]  =     ['tp_instances','fp_instances','tn_instances','fn_instances', 'm_tp_instances', 'm_tn_instances', 'm_fp_instances', 'm_fn_instances']
      let predictions = {}

      let instanceWeights = {};

      instances.forEach((c)=>{
        instanceWeights[c] = 1
      })

      selectionHistory.forEach((s)=>{
        let tmp_instances = [...s.instances]
        let weight = parseFloat((s.weight).toString())
        tmp_instances.forEach((i)=>{
          instanceWeights[i] += weight
        })
      })

      classifiers.forEach((c)=>{
        if (dummyClassifiers.includes(c)) {
          predictions[c] = {}
          instant_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[c][v]
          })
          changed_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[c][v]
          })
        } else {
          predictions[c] = {}
          instant_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[c][v]
          })
        }
        changed_instances_set.forEach((cur_set)=>{
          let cur_instances = [...predictions[c][cur_set]]
          let cur_value = cur_set.substring(0, (cur_set.length)-10)
          let count = 0
          cur_instances.forEach((i)=>{
            count += instanceWeights[i]
          })
          predictions[c][cur_value] = count
        })
        let real_tp = predictions[c].tp + predictions[c].m_tp;
        let real_tn = predictions[c].tn + predictions[c].m_tn;
        let real_fp = predictions[c].fp + predictions[c].m_fp;
        let real_fn = predictions[c].fn + predictions[c].m_fn;
        predictions[c].accuracy  = (real_tp + real_tn) / (real_tp + real_fp + real_tn + real_fn)       
        predictions[c].precision = (real_tp)  / (real_tp + real_fp)   
        predictions[c].recall = (real_tp) / (real_tp + real_fn)
        predictions[c].f1 = (predictions[c].precision + predictions[c].recall == 0) ? 0 : 2 * predictions[c].precision * predictions[c].recall / (predictions[c].precision + predictions[c].recall)
        if ((Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn))) == 0) {
          predictions[c].mcc = 0;
        } 
        if ((real_tp+real_fp)*(real_tp+real_fn)*(real_tn+real_fp)*(real_tn+real_fn) != 0) {
          predictions[c].mcc = ((real_tp*real_tn-real_fp*real_fn) / Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn)))
        } 
      })

      context.commit("setWeightMetrics", predictions)
    },
    updateContinuousMetrics(context) {
      // call this function when bandwidth / threshold changes or when new thresholdclassifier being added
      const classes: string[] = [...this.getters.filteredClasses];
      const dummyClassifiers = [
        'Oracle',
        'Majority Classifier',
        'Random Classifier',
      ];
      const classifiers: string[] = ([...this.getters.filteredClassifiers])
      const instances: string[] = [...this.getters.filteredInstances];
      const classifierThresholdDict = this.state.classifierThresholdDict;
      const classifierBandWidthDict = this.state.classifierBandWidthDict;
      const preContinuousMetrics = this.getters.continuous_metrics;
      let addedThresholdClassifiers = this.state.addedThresholdClassifiers;
      let instant_variables = ['x_roc', 'y_roc', 'value_roc', 'x_pr', 'y_pr', 'line_roc', 'line_pr', 'auc_area', 'acc']
      let changed_variables = ['cur_threshold', 'cur_uncertain', 'cur_left_edge', 'cur_right_edge', 
      'tp','fp','tn','fn', 'm_tp', 'm_tn', 'm_fp', 'm_fn',  
      'tp_instances','fp_instances','tn_instances','fn_instances', 'm_tp_instances', 'm_tn_instances', 'm_fp_instances', 'm_fn_instances',
      'accuracy', 'mcc', 'precision', 'recall', 'f1', 'mcc', 'ins_per' ]      

      let predictions = {}
      classifiers.forEach((c)=>{
        if (dummyClassifiers.includes(c)) {
          predictions[c] = {}
          instant_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[c][v]
          })
          changed_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[c][v]
          })
        }
        else if (Math.abs(preContinuousMetrics[c].cur_threshold - classifierThresholdDict[c]/ 100) < 0.0001
          && (!Object.keys(classifierBandWidthDict).includes(c) || Math.abs(preContinuousMetrics[c].cur_left_edge - classifierBandWidthDict[c].left_range) < 0.0001)
          && (!Object.keys(classifierBandWidthDict).includes(c) || Math.abs(preContinuousMetrics[c].cur_right_edge - classifierBandWidthDict[c].right_range) < 0.0001)){
            predictions[c] = {}
            instant_variables.forEach((v)=>{
              predictions[c][v] = preContinuousMetrics[c][v]
            })
            changed_variables.forEach((v)=>{
              predictions[c][v] = preContinuousMetrics[c][v]
            })
        } else {
          var mse = 0;
          predictions[c] = {}
          instant_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[c][v]
          })
          changed_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[c][v]
          })
          predictions[c].m_tp = 0
          predictions[c].m_tn = 0
          predictions[c].m_fp = 0
          predictions[c].m_fn = 0
          predictions[c].tp = 0
          predictions[c].tn = 0
          predictions[c].fp = 0
          predictions[c].fn = 0
          predictions[c].m_tp_instances = new Set()
          predictions[c].m_tn_instances = new Set()
          predictions[c].m_fp_instances = new Set()
          predictions[c].m_fn_instances = new Set()
          predictions[c].tp_instances = new Set()
          predictions[c].tn_instances = new Set()
          predictions[c].fp_instances = new Set()
          predictions[c].fn_instances = new Set()
          predictions[c].cur_threshold = classifierThresholdDict[c]/100

          if (Object.keys(classifierBandWidthDict).includes(c)) {
            predictions[c].cur_left_edge = classifierBandWidthDict[c].left_range;
            predictions[c].cur_right_edge = classifierBandWidthDict[c].right_range;
          } else {
            predictions[c].cur_left_edge = (predictions[c].cur_threshold - 0.05 < 0? 0 : predictions[c].cur_threshold - 0.05);
            predictions[c].cur_right_edge = (predictions[c].cur_threshold + 0.05 > 1 ? 1 : predictions[c].cur_threshold + 0.05);
          }
          predictions[c].cur_left_edge = parseFloat(predictions[c].cur_left_edge.toFixed(2))
          predictions[c].cur_right_edge = parseFloat(predictions[c].cur_right_edge.toFixed(2))
          predictions[c].cur_uncertain = (predictions[c].cur_left_edge).toFixed(2) + '-' + (predictions[c].cur_right_edge).toFixed(2);
          instances.forEach((id)=>{
            const i = instanceById(id);
            const actual = i.actual == classes[1] ? 1 : 0;
            const predict_prob = i.continuous_predictions[c];
            mse = mse + ((i.continuous_predictions[c] - actual) * (i.continuous_predictions[c] - actual))
            if (predict_prob < predictions[c].cur_right_edge && predict_prob > predictions[c].cur_left_edge) {
              if (actual == 0) {
                if (predict_prob < predictions[c].cur_threshold) {
                  predictions[c].m_tn += 1
                  predictions[c].m_tn_instances.add(id)
                } else {
                  predictions[c].m_fp += 1
                  predictions[c].m_fp_instances.add(id)
                }
              } else {
                if (predict_prob >= predictions[c].cur_threshold) {
                  predictions[c].m_tp += 1
                  predictions[c].m_tp_instances.add(id)
                } else {
                  predictions[c].m_fn += 1
                  predictions[c].m_fn_instances.add(id)
                }
              }
            } else{
              if (actual == 0) {
                if (predict_prob < predictions[c].cur_left_edge) {
                  predictions[c].tn += 1
                  predictions[c].tn_instances.add(id)
                } else {
                  predictions[c].fp += 1
                  predictions[c].fp_instances.add(id)
                }
              } else {
                if (predict_prob >= predictions[c].cur_right_edge) {
                  predictions[c].tp += 1
                  predictions[c].tp_instances.add(id)
                } else {
                  predictions[c].fn += 1
                  predictions[c].fn_instances.add(id)
                }
              }
            }

          })
          let real_tp = predictions[c].tp + predictions[c].m_tp;
          let real_tn = predictions[c].tn + predictions[c].m_tn;
          let real_fp = predictions[c].fp + predictions[c].m_fp;
          let real_fn = predictions[c].fn + predictions[c].m_fn;
          let precentage = ((predictions[c].tp + predictions[c].fp + predictions[c].tn + predictions[c].fn ) / instances.length).toFixed(2);
          predictions[c].ins_per = precentage
          predictions[c].mse = mse
          predictions[c].accuracy  = (real_tp + real_tn) / (real_tp + real_fp + real_tn + real_fn)       
          predictions[c].precision = (real_tp)  / (real_tp + real_fp)   
          predictions[c].recall = (real_tp) / (real_tp + real_fn)
          predictions[c].f1 = (predictions[c].precision + predictions[c].recall == 0) ? 0 : 2 * predictions[c].precision * predictions[c].recall / (predictions[c].precision + predictions[c].recall)
          if ((Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn))) == 0) {
            predictions[c].mcc = 0;
          } 
          if ((real_tp+real_fp)*(real_tp+real_fn)*(real_tn+real_fp)*(real_tn+real_fn) != 0) {
            predictions[c].mcc = ((real_tp*real_tn-real_fp*real_fn) / Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn)))
          } 
        }
      })

      if (addedThresholdClassifiers === null ) {
        addedThresholdClassifiers = []
      }
      addedThresholdClassifiers.forEach((c)=>{
        c = c.name
        if (Object.keys(preContinuousMetrics).includes(c)) {
          predictions[c] = {}
          instant_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[c][v]
          })
          changed_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[c][v]
          })
        } else {
          let origin_classifier = c.substring(4,c.length-5)
          let threshold = parseFloat(c.substring(c.length-4,c.legend))
          predictions[c] = {}
          instant_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[origin_classifier][v]
          })
          changed_variables.forEach((v)=>{
            predictions[c][v] = preContinuousMetrics[origin_classifier][v]
          })
          predictions[c].m_tp = 0
          predictions[c].m_tn = 0
          predictions[c].m_fp = 0
          predictions[c].m_fn = 0
          predictions[c].tp = 0
          predictions[c].tn = 0
          predictions[c].fp = 0
          predictions[c].fn = 0
          predictions[c].m_tp_instances = new Set()
          predictions[c].m_tn_instances = new Set()
          predictions[c].m_fp_instances = new Set()
          predictions[c].m_fn_instances = new Set()
          predictions[c].tp_instances = new Set()
          predictions[c].tn_instances = new Set()
          predictions[c].fp_instances = new Set()
          predictions[c].fn_instances = new Set()
          predictions[c].cur_threshold = threshold
          if (Object.keys(classifierBandWidthDict).includes(c)) {
            predictions[c].cur_left_edge = classifierBandWidthDict[c].left_range;
            predictions[c].cur_right_edge = classifierBandWidthDict[c].right_range;
          } 
          predictions[c].cur_left_edge = predictions[c].cur_threshold - 0.05 < 0 ? 0 : predictions[c].cur_threshold - 0.05;
          predictions[c].cur_right_edge = predictions[c].cur_threshold + 0.05 > 1 ? 1 : predictions[c].cur_threshold + 0.05;
          predictions[c].cur_uncertain = predictions[c].cur_left_edge + '-' + predictions[c].cur_right_edge;

          predictions[c].cur_left_edge = parseFloat(predictions[c].cur_left_edge.toFixed(2))
          predictions[c].cur_right_edge = parseFloat(predictions[c].cur_right_edge.toFixed(2))
          instances.forEach((id)=>{
            const i = instanceById(id);
            const actual = i.actual == classes[1] ? 1 : 0;
            const predict_prob = i.continuous_predictions[origin_classifier];
            if (predict_prob <= predictions[c].cur_right_edge && predict_prob >= predictions[c].cur_left_edge) {
              if (actual == 0) {
                if (predict_prob < predictions[c].cur_threshold) {
                  predictions[c].m_tn += 1
                  predictions[c].m_tn_instances.add(id)
                } else {
                  predictions[c].m_fp += 1
                  predictions[c].m_fp_instances.add(id)
                }
              } else {
                if (predict_prob >= predictions[c].cur_threshold) {
                  predictions[c].m_tp += 1
                  predictions[c].m_tp_instances.add(id)
                } else {
                  predictions[c].m_fn += 1
                  predictions[c].m_fn_instances.add(id)
                }
              }
            } else{
              if (actual == 0) {
                if (predict_prob < predictions[c].cur_left_edge) {
                  predictions[c].tn += 1
                  predictions[c].tn_instances.add(id)
                } else {
                  predictions[c].fp += 1
                  predictions[c].fp_instances.add(id)
                }
              } else {
                if (predict_prob >= predictions[c].cur_right_edge) {
                  predictions[c].tp += 1
                  predictions[c].tp_instances.add(id)
                } else {
                  predictions[c].fn += 1
                  predictions[c].fn_instances.add(id)
                }
              }
            }

          })
          let real_tp = predictions[c].tp + predictions[c].m_tp;
          let real_tn = predictions[c].tn + predictions[c].m_tn;
          let real_fp = predictions[c].fp + predictions[c].m_fp;
          let real_fn = predictions[c].fn + predictions[c].m_fn;
          let precentage = ((predictions[c].tp + predictions[c].fp + predictions[c].tn + predictions[c].fn ) / instances.length).toFixed(2);
          predictions[c].ins_per = precentage
          predictions[c].accuracy  = (real_tp + real_tn) / (real_tp + real_fp + real_tn + real_fn)       
          predictions[c].precision = (real_tp)  / (real_tp + real_fp)   
          predictions[c].recall = (real_tp) / (real_tp + real_fn)
          predictions[c].f1 = (predictions[c].precision + predictions[c].recall == 0) ? 0 : 2 * predictions[c].precision * predictions[c].recall / (predictions[c].precision + predictions[c].recall)
          if ((Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn))) == 0) {
            predictions[c].mcc = 0;
          } 
          if ((real_tp+real_fp)*(real_tp+real_fn)*(real_tn+real_fp)*(real_tn+real_fn) != 0) {
            predictions[c].mcc = ((real_tp*real_tn-real_fp*real_fn) / Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn)))
          } 
        }
      })
      context.commit("setContinuousMetrics", predictions)
    },
    changedContinuousMetrics(context) {
      // call this function when new classifier have been added
      const predictions: {
        [classifier: string]: {
          x_roc: Number[],
          y_roc: Number[],
          value_roc: Number[],
          x_pr: Number[],
          y_pr: Number[],
          acc:Number[],
          line_roc: string,
          line_pr: string,
          auc_area: number,
          cur_threshold: number,
          cur_uncertain: string,
          cur_left_edge: number,
          cur_right_edge: number,
          tp: number,
          tn: number,
          fp: number,
          fn: number,
          m_tp: number,
          m_tn: number,
          m_fp: number,
          m_fn: number, 
          tp_instances: Set<string>,
          tn_instances: Set<string>,
          fn_instances: Set<string>,
          fp_instances: Set<string>,
          m_tp_instances: Set<string>,
          m_tn_instances: Set<string>,
          m_fn_instances: Set<string>,
          m_fp_instances: Set<string>,
          accuracy: number,
          mcc: number,
          precision: number,
          recall: number,
          f1: number    ,        
          mse:number,
          ins_per: string
        },
      } = {};

      var classifierValues = {}
      const classes: string[] = [...this.getters.filteredClasses];
      const classifiers: string[] = [...this.getters.filteredClassifiers];
      const instances: string[] = [...this.getters.filteredInstances];
      const classifierThresholdDict = this.state.classifierThresholdDict;
      const classifierBandWidthDict = this.state.classifierBandWidthDict;
      var classifierThresholdKey = []
      const formatDecimal = d3.format(".4f")
      for (var i in classifierThresholdDict) {
        classifierThresholdKey.push(i)
      }

      classifiers.forEach((c) => {
        predictions[c] = {
          x_roc: [],
          y_roc: [],
          value_roc:[],
          x_pr: [],
          y_pr: [],
          acc: [],
          line_roc: "",
          line_pr: "",
          auc_area: 0,
          cur_threshold: 0,
          cur_uncertain: '',
          cur_left_edge: 0,
          cur_right_edge: 0,
          tp: 0,
          tn: 0,
          fp: 0,
          fn: 0,
          m_tp: 0,
          m_tn: 0,
          m_fp: 0,
          m_fn: 0,
          tp_instances: new Set(),
          tn_instances: new Set(),
          fn_instances: new Set(),
          fp_instances: new Set(),
          m_tp_instances: new Set(),
          m_tn_instances: new Set(),
          m_fn_instances: new Set(),
          m_fp_instances: new Set(),
          accuracy: 0,
          mcc: 0,
          precision: 0,
          recall: 0,
          f1: 0,    
          mse:0,
          ins_per:'0'
        };
        classifierValues[c] = []
      });


      let begin = 0;
      let end = 1;
      let diff = 0.01;
      while(begin <= end) {
        classifiers.forEach((c)=>{
          classifierValues[c].push(begin.toFixed(3))
        })
        begin += diff
      }

      classifiers.forEach((c)=>{
        var coordinates = []
        var mse = 0;
        classifierValues[c].sort();
        if (classifierThresholdKey.length == 0) predictions[c].cur_threshold = 0;
        else predictions[c].cur_threshold = classifierThresholdDict[c]/100
        if (Object.keys(classifierBandWidthDict).includes(c)) {
          predictions[c].cur_left_edge = classifierBandWidthDict[c].left_range;
          predictions[c].cur_right_edge = classifierBandWidthDict[c].right_range;
        } else{
          predictions[c].cur_left_edge = (predictions[c].cur_threshold - 0.05) < 0 ? 0 : predictions[c].cur_threshold - 0.05;
          predictions[c].cur_right_edge = predictions[c].cur_threshold + 0.05 > 1 ? 1 : predictions[c].cur_threshold + 0.05;
        }
        predictions[c].cur_left_edge = parseFloat(predictions[c].cur_left_edge.toFixed(2))
        predictions[c].cur_right_edge = parseFloat(predictions[c].cur_right_edge.toFixed(2))
        predictions[c].cur_uncertain = predictions[c].cur_left_edge + '-' + predictions[c].cur_right_edge;
        instances.forEach((id)=>{
          const i = instanceById(id);
          const actual = i.actual == classes[1] ? 1 : 0;
          const predict_prob = i.continuous_predictions[c];
          mse = mse + ((i.continuous_predictions[c] - actual) * (i.continuous_predictions[c] - actual))
          if (predict_prob < predictions[c].cur_right_edge && predict_prob > predictions[c].cur_left_edge) {
            if (actual == 0) {
              if (predict_prob < predictions[c].cur_threshold) {
                predictions[c].m_tn += 1
                predictions[c].m_tn_instances.add(id)
              } else {
                predictions[c].m_fp += 1
                predictions[c].m_fp_instances.add(id)
              }
            } else {
              if (predict_prob >= predictions[c].cur_threshold) {
                predictions[c].m_tp += 1
                predictions[c].m_tp_instances.add(id)
              } else {
                predictions[c].m_fn += 1
                predictions[c].m_fn_instances.add(id)
              }
            }
          } else{
            if (actual == 0) {
              if (predict_prob < predictions[c].cur_threshold) {
                predictions[c].tn += 1
                predictions[c].tn_instances.add(id)
              } else {
                predictions[c].fp += 1
                predictions[c].fp_instances.add(id)
              }
            } else {
              if (predict_prob >= predictions[c].cur_threshold) {
                predictions[c].tp += 1
                predictions[c].tp_instances.add(id)
              } else {
                predictions[c].fn += 1
                predictions[c].fn_instances.add(id)
              }
            }
          }

        })
        let real_tp = predictions[c].tp + predictions[c].m_tp;
        let real_tn = predictions[c].tn + predictions[c].m_tn;
        let real_fp = predictions[c].fp + predictions[c].m_fp;
        let real_fn = predictions[c].fn + predictions[c].m_fn;
        let precentage = ((predictions[c].tp + predictions[c].fp + predictions[c].tn + predictions[c].fn ) / instances.length).toFixed(2);
        predictions[c].ins_per = precentage
        predictions[c].mse = mse
        predictions[c].accuracy  = (real_tp + real_tn) / (real_tp + real_fp + real_tn + real_fn)       
        predictions[c].precision = (real_tp)  / (real_tp + real_fp)   
        predictions[c].recall = (real_tp) / (real_tp + real_fn)
        predictions[c].f1 = (predictions[c].precision + predictions[c].recall == 0) ? 0 : 2 * predictions[c].precision * predictions[c].recall / (predictions[c].precision + predictions[c].recall)
        if ((Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn))) == 0) {
          predictions[c].mcc = 0;
        } 
        if ((real_tp+real_fp)*(real_tp+real_fn)*(real_tn+real_fp)*(real_tn+real_fn) != 0) {
          predictions[c].mcc = ((real_tp*real_tn-real_fp*real_fn) / Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn)))
        } 

        let last_acc = 0
        let last_value = '0'
        let PerfCalculation = (value:string) =>{
          let tp = 0;
          let fp = 0;
          let fn = 0;
          let tn = 0;
          instances.forEach((id)=>{
            const i = instanceById(id);
            const predict = i.continuous_predictions[c] < parseFloat(value) ? classes[0] : classes[1];
            if (i.actual == classes[1]) {
              if (predict == i.actual) {
                tp+=1;
              } else {
                fn+=1;
              }
            } else {
              if (predict == i.actual) {
                tn+=1;
              } else {
                fp+=1;
              }
            }
          })
          return [tp, tn, fp, fn]
        }
        let addNewValues = (tp:number, tn:number, fp:number, fn:number, value:number)=>{
          coordinates.push({"x":fp/(fp+tn), "y":tp/(tp+fn)});
          predictions[c].x_roc.push((fp/(fp+tn)))
          predictions[c].y_roc.push((tp/(tp+fn)))
          predictions[c].value_roc.push(value)
          predictions[c].x_pr.push((tp/(tp+fn)))
          predictions[c].y_pr.push((tp/(tp+fp)))
          predictions[c].acc.push((tn+tp)/(tn+tp+fn+fp))
        }

        function adaptSampling(low, high, pre, cur, count) {
          if (count > 100) {
            return
          }
          if (Math.abs (pre- cur) / pre > 0.5) {
            let mid = ((parseFloat(high) + parseFloat(low)) / 2).toString()
            let tmp_perf = PerfCalculation(mid)
            let mid_value = (tmp_perf[0]+tmp_perf[1])/(tmp_perf[1]+tmp_perf[0]+tmp_perf[2]+tmp_perf[3])
            
            if (Math.abs(mid_value - pre) / pre > 0.5){
              adaptSampling(low, mid, pre, mid_value, count + 1)
              addNewValues(tmp_perf[0], tmp_perf[1], tmp_perf[2], tmp_perf[3], parseFloat(mid))
            }
            if (Math.abs(cur - mid_value) / cur > 0.5){
              addNewValues(tmp_perf[0], tmp_perf[1], tmp_perf[2], tmp_perf[3], parseFloat(mid))
              adaptSampling(mid, high,mid_value, cur, count + 1)
            }
          } 
          return 
        }
 
        classifierValues[c].forEach((value, idx)=>{
          value = formatDecimal(value)
          let perf = PerfCalculation(value)
          let tp = perf[0];
          let tn = perf[1];
          let fp = perf[2];
          let fn = perf[3];
          
          if (idx == 0) {
            last_acc = (tn+tp)/(tn+tp+fn+fp)
            last_value = value
          } else {
            let cur = (tn+tp)/(tn+tp+fn+fp)
            adaptSampling(last_value, value, last_acc, cur, 0)
            last_acc = cur
            last_value = value
          }
         
          addNewValues(tp, tn, fp, fn, value)
        })

        predictions[c].auc_area = 0;
        var lastx = 0;
        var lasty = 0;
        coordinates.sort(function(x, y){
          return d3.ascending(x.x, y.x);
        })
        coordinates.forEach((cor)=>{
          predictions[c].auc_area += (((cor.y + lasty) * (cor.x - lastx) / 2))
          lastx = cor.x;
          lasty = cor.y;
        })
      })

      context.commit("setContinuousMetrics", predictions)
      
    },
    changedDatasetContinuous(context) {
      const curClassifier = this.state.chosenClassifierThresholdTuple.classifier;
      const curThreshold = this.state.chosenClassifierThresholdTuple.single_threshold;

      let tmp_classifierThresholds  = this.state.classifierThresholdDict;
      let tmp_thresholdsClassifier = this.state.thresholdClassifierNameList.map((d)=>d)
      tmp_classifierThresholds[curClassifier] = curThreshold
      context.commit("setClassifierThresholdDict",tmp_classifierThresholds);
      context.dispatch("updateContinuousMetrics")

      for (let i in tmp_thresholdsClassifier) {
        let c = tmp_thresholdsClassifier[i]
        if (c.indexOf(curClassifier)==0) {
          tmp_thresholdsClassifier[i] = curClassifier + "_" + curThreshold
        }
      }
      context.commit("setThresholdClassifierNameList",tmp_thresholdsClassifier);

      const classes = this.state.chosenDataset.classes
      const classifiers = this.state.chosenDataset.classifiers
      const instances = this.state.chosenDataset.instances
      
      for (let j in classifiers) {
        let c = classifiers[j]
        if (c!=curClassifier) {
          continue
        }
        let tmp_predictions = []
        for (let i in instances) {
          const continuous_predictions = instances[i].continuous_predictions
          if (parseFloat(continuous_predictions[c]) < curThreshold / 100) {
            tmp_predictions.push(classes[0])
            instances[i].predictions[c] = classes[0]
          } else {
            tmp_predictions.push(classes[1])
            instances[i].predictions[c] = classes[1]
          }
        }
      }
    },
    changedFilter(
      context,
      payload: {
        entityType: EntityType,
        newFilter: {
          type: SelectionAction,
          set: Set<string>,
        },
      },
    ) {
      context.commit('setFilter', payload);
    },
    changedHoverInstance(context, id) {
      context.commit('setHoverInstance', id);
    },
    changedMostRecentSelection(context, whichOverlap: 'first' | 'second') {
      const mostRecentSelection = context.state.selectionHistory[0];
      context.dispatch('changedOverlapSelection', {
        selection: mostRecentSelection,
        whichOverlap,
      });
    },
    setFocusItem(context, id){
      context.commit('mutateFocusItem', id)
    },
    changeFocusSet(context, id){
      context.commit('mutateFocusSet', id)
    },
  },
  getters: {
    curveChosenClassifierThresholdTuple(state) {
      return state.curveChosenClassifierThresholdTuple;
    },
    classifierBandWidthDict(state) {
      return state.classifierBandWidthDict;
    },
    withinClassifierBandWidthList(state) {
      return state.withinClassifierBandWidthList;
    },
    withinClassifierName(state) {
      return state.withinClassifierName;
    },
    classifierThresholdDict(state) {
      return state.classifierThresholdDict;
    },
    thresholdClassifierNameList(state) {
      return state.thresholdClassifierNameList;
    },
    classifierThresholdList(state,getters): ThresholdWithClassifier[] {
      const allClassifiers: string[] = [...getters.filteredClassifiers];
      const dummyClassifiers = [
        'Oracle',
        'Majority Classifier',
        'Random Classifier',
      ];
      const realClassifiers = allClassifiers.filter((c) => !dummyClassifiers.includes(c) && c!="");
      const thresholdClassifier: ThresholdWithClassifier[]= realClassifiers.map((c)=> {
        return {
          classifier: c,
          single_threshold: 50,
        };
      });
      return thresholdClassifier;
    },
    continuousThresholdClassifiers(state) {
      return new Set(state.chosenDataset.classifiers);
    },
    datasetType(state) {
      return state.datasetType;
    },
    fixedDataset(state) {
      return state.fixedDataset
    },
    viewWidth(state) {
      return state.viewWidth;
    },
    intersectionMode(state) {
      return state.intersectionMode;
    },
    classes(state): Set<string> {
      return new Set(state.chosenDataset.classes);
    },
    classifiers(state): Set<string> {
      return new Set(state.chosenDataset.classifiers);
    },
    feature(state): (id: string) => Feature {
      return (id: string) => state.chosenDataset.features[id];
    },
    features(state): Set<string> {
      return new Set(Object.keys(state.chosenDataset.features));
    },
    instance(state): (id: string) => Instance {
      return (id: string) => state.chosenDataset.instances[id];
    },
    instances(state): Set<string> {
      return state.baseSelection.instances;
    },
    filteredClasses(state, getters): Set<string> {
      const classesToExclude = state.filters.class.set;
      const classes = getters.classes;
      const filteredClasses = difference(classes, classesToExclude);
      return filteredClasses;
    },
    filteredClassifiers(state, getters): Set<string> {
      const classifiersToExclude = state.filters.classifier.set;
      const classifiers = getters.classifiers;
      const filteredClassifiers = difference(classifiers, classifiersToExclude);
      return filteredClassifiers;
    },
    filteredInstances(state, getters): Set<string> {
      let filteredInstances: string[] = [...getters.instances];
      const trainOrTest = 'train_or_test';
      switch (state.baseDataset) {
        case 'test':
          if (state.currentChosenFold != '') {
            state.validationList.forEach((fold)=>{
              if (fold.name == state.currentChosenFold) {
                filteredInstances = [...fold.testing];
              }
            })
          } else {
            filteredInstances = filteredInstances.filter((i) => {
              return instanceById(i).features[trainOrTest] === 'test' ||
                instanceById(i).features[trainOrTest] === '0';
            });
          }
          break;
        case 'train':
          if (state.currentChosenFold != '') {
              state.validationList.forEach((fold)=>{
                if (fold.name == state.currentChosenFold) {
                  filteredInstances = [...fold.training];
                }
              })
          } else {
            filteredInstances = filteredInstances.filter((i) => {
              return instanceById(i).features[trainOrTest] === 'train' ||
                instanceById(i).features[trainOrTest] === '1';
            });
          }
          break;
        case 'sample':
          filteredInstances = [...state.sampleDict['instances']]
          break;
      }
      return new Set(filteredInstances);
    },
    additionMetrics(state, getters): {
      [classifier: string]: Metrics,
    }  {
      const classes: string[] = [...getters.filteredClasses];
      const classifiers: string[] = state.addedThresholdClassifiers;
      const instances: string[] = [...getters.filteredInstances];

      const metrics: {
        [classifier: string]: Metrics,
      } = {};
      
      classifiers.forEach((additionC) => {
        // create all metrics
        let c = additionC['name']
        let classifier = c.substring(4,c.length-5)
        let threshold = parseFloat(c.substring(c.length-4,c.length))

        metrics[c] = {
          accuracy: -1,
          acc: { average: -1 },
          mcc: { average: -1 },
          f1: { average: -1 },
          microf1: { average: -1 },
          macrof1: { average: -1 },
          precision: { average: -1 },
          recall: { average: -1 },
          predicted: {},
          actual: {},
          false: {},
          true: {},
          tp: {},
          fp: {},
          fn: {},
          tn: {},
        };
        const m = metrics[c];
        // actual and predicted of a class
        classes.forEach((actualClass) => {
          m.actual[actualClass] = new Set(instances.filter((i) => instanceById(i).actual === actualClass));
        });
        classes.forEach((predictedClass) => {
          m.predicted[predictedClass] = new Set(instances.filter((i) =>
            predictedClass == classes[0] ? instanceById(i).continuous_predictions[classifier] <= threshold
                                      : instanceById(i).continuous_predictions[classifier] > threshold
            // instanceById(i).predictions[classifier] === predictedClass
            ));
        });
        
        
        classes.forEach((actualClass) => {
          m.true[actualClass] = intersection(m.actual[actualClass], m.predicted[actualClass]);
        });
        classes.forEach((actualClass) => {
          m.false[actualClass] = difference(m.predicted[actualClass], m.actual[actualClass]);
        });

        classes.forEach((actualClass)=>{
          m.tp[actualClass]  = new Set();
          m.fp[actualClass]  = new Set();
          m.fn[actualClass]  = new Set();
          m.tn[actualClass]  = new Set();
        })

        instances.forEach((id) => {
          const i = instanceById(id);
          var c = classifier
          if (i.actual == classes[1]) {
              if (i.continuous_predictions[c] >= threshold) {
                m.tp[classes[1]].add(id);
              } else {
                m.fn[classes[1]].add(id);
              }
          } else {
            if (i.continuous_predictions[c] < threshold) {
              m.tn[classes[1]].add(id);
            } else {
              m.fp[classes[1]].add(id);
            }
          }
        })
        
        // accuracy
        let totalTrue = 0;
        classes.forEach((actualClass) => {
          totalTrue += m.true[actualClass].size;
        });
        m.accuracy = totalTrue / instances.length;


        // precision pre class
        var className = classes[1]
        m.precision[className] =  m.tp[className].size / (m.tp[className].size + m.fp[className].size);
        m.precision[classes[0]] = 1-m.precision[className];
        m.precision.average = m.precision[className] 
        
        

        
        // recall pre class
        var className = classes[1]
        m.recall[className] =  m.tp[className].size / (m.tp[className].size + m.fn[className].size);
        m.recall[classes[0]] = 1-m.recall[className];
        m.recall.average = m.recall[className] 
        
        
        // f1
        var className = classes[1]
        const p = m.precision[className];
        const r = m.recall[className];
        m.f1[className] = 2 * p * r / (p + r);
        m.f1[classes[0]] = 2 * (1-p)*(1-r) / (2-p-r)
        m.f1.average = m.f1[className]

        
        // mcc
        var className = classes[1]
        var tp = m.tp[className].size;
        var tn = m.tn[className].size;
        var fp = m.fp[className].size;
        var fn = m.fn[className].size;
        if ((Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))) == 0) {
          m.mcc.average = 0;
        } 
        if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
          m.mcc.average = ((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn)))
        } 
      });

      return metrics;
    },
    metrics(state, getters): {
      [classifier: string]: Metrics,
    }  {
      const classes: string[] = [...getters.filteredClasses];
      const classifiers: string[] = [...getters.filteredClassifiers];
      const instances: string[] = [...getters.filteredInstances];

      const metrics: {
        [classifier: string]: Metrics,
      } = {};
      classifiers.forEach((classifier) => {
        // create all metrics
        metrics[classifier] = {
          accuracy: -1,
          acc: { average: -1 },
          mcc: { average: -1 },
          f1: { average: -1 },
          microf1: { average: -1 },
          macrof1: { average: -1 },
          precision: { average: -1 },
          recall: { average: -1 },
          predicted: {},
          actual: {},
          false: {},
          true: {},
          tp: {},
          fp: {},
          fn: {},
          tn: {},
        };
        const m = metrics[classifier];
        // actual and predicted of a class
        classes.forEach((actualClass) => {
          m.actual[actualClass] = new Set(instances.filter((i) => instanceById(i).actual === actualClass));
        });
        classes.forEach((predictedClass) => {
          m.predicted[predictedClass] = new Set(instances.filter((i) =>
            instanceById(i).predictions[classifier] === predictedClass));
        });
        
        // true false per class 
        if (classes.length > 2) {
          classes.forEach((actualClass) => {
            var cur_predictions = [...m.predicted[actualClass]]
            var cur_actuals = [...m.actual[actualClass]]
            m.true[actualClass] = intersection(m.actual[actualClass], m.predicted[actualClass]);
            m.tp[actualClass] = m.true[actualClass];
            m.fp[actualClass] = new Set(cur_predictions.filter((i) => !cur_actuals.includes(i)));
            m.fn[actualClass] = new Set(cur_actuals.filter((i) => !cur_predictions.includes(i)));
          });
          classes.forEach((actualClass) => {
            m.false[actualClass] = difference(m.predicted[actualClass], m.actual[actualClass]);
          });
  
          classes.forEach((actualClass)=>{
            m.tn[actualClass]  = new Set();
            classes.forEach((restClass)=>{
              if (restClass != actualClass) {
                m.tn[actualClass]  = new Set([...m.tn[actualClass], ...m.tp[restClass]])
              }
            })
          })
        } else {
          classes.forEach((actualClass) => {
            m.true[actualClass] = intersection(m.actual[actualClass], m.predicted[actualClass]);
          });
          classes.forEach((actualClass) => {
            m.false[actualClass] = difference(m.predicted[actualClass], m.actual[actualClass]);
          });
  
          classes.forEach((actualClass)=>{
            m.tp[actualClass]  = new Set();
            m.fp[actualClass]  = new Set();
            m.fn[actualClass]  = new Set();
            m.tn[actualClass]  = new Set();
          })

          instances.forEach((id) => {
            const i = instanceById(id);
            var c = classifier
            if (i.actual == classes[1]) {
                if (i.predictions[c] == i.actual) {
                  m.tp[classes[1]].add(id);
                } else {
                  m.fn[classes[1]].add(id);
                }
              } else {
                if (i.predictions[c] == i.actual) {
                  m.tn[classes[1]].add(id);
                } else {
                  m.fp[classes[1]].add(id);
                }
              }
          })
        }
        // accuracy
        let totalTrue = 0;
        classes.forEach((actualClass) => {
          totalTrue += m.true[actualClass].size;
        });
        m.accuracy = totalTrue / instances.length;


        // precision pre class
        if (classes.length > 2) {
          let precisionSum = 0;
          classes.forEach((className) => {
            m.precision[className] = m.tp[className].size / (m.tp[className].size + m.fp[className].size);
            precisionSum += m.precision[className];
          });
          m.precision.average = precisionSum / classes.length;
        } else {
          var className = classes[1]
          m.precision[className] =  m.tp[className].size / (m.tp[className].size + m.fp[className].size);
          m.precision[classes[0]] = 1-m.precision[className];
          m.precision.average = m.precision[className] 
        }
        

        
        // recall pre class
        if (classes.length > 2) {
          let recallSum = 0;
          classes.forEach((className) => {
            m.recall[className] = m.tp[className].size / (m.tp[className].size + m.fn[className].size);
            recallSum += m.recall[className];
          });
          m.recall.average = recallSum / classes.length;
        } else {
          var className = classes[1]
          m.recall[className] =  m.tp[className].size / (m.tp[className].size + m.fn[className].size);
          m.recall[classes[0]] = 1-m.recall[className];
          m.recall.average = m.recall[className] 
        }
        
        // f1
        if (classes.length > 2) {
          let f1Sum = 0;
          classes.forEach((className) => {
            const p = m.precision[className];
            const r = m.recall[className];
            m.f1[className] = 2 * p * r / (p + r);
            f1Sum += m.f1[className];
          });
          m.f1.average = f1Sum / classes.length;
        } else {
          var className = classes[1]
          const p = m.precision[className];
          const r = m.recall[className];
          m.f1[className] = 2 * p * r / (p + r);
          m.f1[classes[0]] = 2 * (1-p)*(1-r) / (2-p-r)
          m.f1.average = m.f1[className]
        }
         

        // micro f1
        let tpSum = 0;
        let fpSum = 0;
        let fnSum = 0;
        classes.forEach((className) => {
          tpSum += m.tp[className].size;
          fpSum += m.fp[className].size;
          fnSum += m.fn[className].size;
        });
        let microPrecision = tpSum / (tpSum + fpSum);
        let microRecall = tpSum / (tpSum + fnSum);
        m.microf1.average = m.f1.average//2 * microPrecision * microRecall / (microPrecision + microRecall);

        // macro f1
        m.macrof1.average = 2 * microPrecision * microRecall / (microPrecision + microRecall);//2 * m.precision.average * m.recall.average / (m.precision.average + m.recall.average);

        // mcc
        if (classes.length > 2) {
          var tp = 0;
          var tn = 0;
          var fp = 0;
          var fn = 0;
          classes.forEach((className) => {
            tp += m.tp[className].size;
            tn += m.tn[className].size;
            fp += m.fp[className].size;
            fn += m.fn[className].size;
          })
          if ((Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))) == 0) {
            if ((tp * tn - tp * fn) < 0){
              m.mcc.average = -1;
            } else {
              m.mcc.average = 1;
            }
          } else {
            m.mcc.average = (tp * tn - tp * fn) / (Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)));
          }
        } else {
          var className = classes[1]
          var tp = m.tp[className].size;
          var tn = m.tn[className].size;
          var fp = m.fp[className].size;
          var fn = m.fn[className].size;
          if ((Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))) == 0) {
            m.mcc.average = 0;
          } 
          if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
            m.mcc.average = ((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn)))
          } 
        }
        
      });

      return metrics;
    },
    continuous_metrics(state) {
      return state.continuous_metrics;
    },
    weighted_metrics(state){
      return state.weighted_metrics;
    },
    visualizations(state, getters): Visualization[] {
      const visualizations: Visualization[] = [];
      const openViews = state.views.open;
      openViews.forEach((view) => {

        const visualizationTemplate = () => {
          return {
            name: view,
            boxProps: {
              classes: getters.filteredClasses,
              classifiers: getters.filteredClassifiers,
              instances: getters.filteredInstances,
              features: getters.features,
              thresholdClassifierNameList: getters.thresholdClassifierNameList,
              classifierBandWidthDict:getters.classifierBandWidthDict,
              withinClassifierBandWidthList: getters.withinClassifierBandWidthList,
            },
          };
        };
        
       
        switch (view) {
          case VisualizationType.CA:
          case VisualizationType.SCP:
          case VisualizationType.COV:
          case VisualizationType.CC:
          case VisualizationType.CB:
          case VisualizationType.RC:
          case VisualizationType.BA:
          case VisualizationType.REC:
          case VisualizationType.TID:  
          case VisualizationType.UM:
          case VisualizationType.CMG:
          case VisualizationType.FH:
          case VisualizationType.OCA:
          case VisualizationType.PCC:
          case VisualizationType.SMP:
          case VisualizationType.SP:
          case VisualizationType.SM:
          case VisualizationType.ITL:
          case VisualizationType.FI:
            visualizations.push(visualizationTemplate());
            break;
          default:
            console.error('Visualization', view, 'not implemented');
            break;
        }
      });

      return visualizations;
    },

  },
});
