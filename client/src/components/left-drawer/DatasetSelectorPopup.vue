<template>

  <v-card>
    <div id="app">
          <vue-instant-loading-spinner ref="Spinner"></vue-instant-loading-spinner>
        </div>

    <v-card-title>
      <h2>Dataset list</h2>
    </v-card-title>
    <v-card-text>
      <v-list>
        <v-list-item
          v-for="dataset in Object.keys(this.$store.state.datasets)"
          :key="dataset"
          @click="[changedDatasetByName(dataset), test()]"
        >
          <v-list-item-content>
            <v-list-item-title v-text="dataset"></v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
      <v-layout>
        <v-flex xs8>
          <v-text-field
            label="Enter Custom Dataset URL"
            outline
            v-model="customDatasetURL"
          ></v-text-field>
        </v-flex>
        <v-flex xs4>
          <v-btn
            @click="() => { changedDataset(customDatasetURL); customDatasetURL = '', test()}"
          >
            Load
          </v-btn>
        </v-flex>
      </v-layout>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import Vue from 'vue';
import { mapActions } from 'vuex';
import VueInstantLoadingSpinner from 'vue-instant-loading-spinner/src/components/VueInstantLoadingSpinner.vue'

export default Vue.extend({
  name: 'DatasetSelectorPopup',
  components: {
    VueInstantLoadingSpinner
  },
  data() {
    return {
      customDatasetURL: '',
    };
  },
  methods: {
    test: function () {
      console.log('call test')
      this.$refs.Spinner.show();
      setTimeout(function () {
        this.$refs.Spinner.hide();
      }.bind(this), 5000);
    },
    ...mapActions([
      'changedDataset',
      'changedDatasetByName',
    ]),
  },
});
</script>
