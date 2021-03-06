define(["require", "exports", "angular", "underscore", "pascalprecht.translate"], function (require, exports, angular, _) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var moduleName = require('feed-mgr/feeds/edit-feed/module-name');
    var directive = function () {
        return {
            restrict: "EA",
            bindToController: {},
            controllerAs: 'vm',
            scope: {
                versions: '=?'
            },
            templateUrl: 'js/feed-mgr/feeds/edit-feed/details/feed-nifi-properties.html',
            controller: "FeedNifiPropertiesController",
            link: function ($scope, element, attrs, controller) {
                if ($scope.versions == undefined) {
                    $scope.versions = false;
                }
            }
        };
    };
    var FeedNIFIController = /** @class */ (function () {
        function FeedNIFIController($scope, $http, $q, RestUrlService, AccessControlService, EntityAccessControlService, FeedService, EditFeedNifiPropertiesService, FeedInputProcessorOptionsFactory, FeedDetailsProcessorRenderingHelper, BroadcastService, FeedPropertyService, $filter) {
            this.$scope = $scope;
            this.$http = $http;
            this.$q = $q;
            this.RestUrlService = RestUrlService;
            this.AccessControlService = AccessControlService;
            this.EntityAccessControlService = EntityAccessControlService;
            this.FeedService = FeedService;
            this.EditFeedNifiPropertiesService = EditFeedNifiPropertiesService;
            this.FeedInputProcessorOptionsFactory = FeedInputProcessorOptionsFactory;
            this.FeedDetailsProcessorRenderingHelper = FeedDetailsProcessorRenderingHelper;
            this.BroadcastService = BroadcastService;
            this.FeedPropertyService = FeedPropertyService;
            this.$filter = $filter;
            /**
             * The ng-form object
             * @type {{}}
             */
            this.feedDetailsForm = {};
            /**
             * The model when editing
             * @type {{}}
             */
            this.editModel = {};
            /**
             * Flag to determine if we are editing or not
             * @type {boolean}
             */
            this.editableSection = false;
            /**
             * The property for the date field
             * @type {string}
             */
            this.INCREMENTAL_DATE_PROPERTY_KEY = 'Date Field';
            this.versions = $scope.versions;
            //dont allow editing if we are looking at versions
            this.allowEdit = !this.versions;
            this.model = this.FeedService.editFeedModel;
            this.versionFeedModel = this.FeedService.versionFeedModel;
        }
        FeedNIFIController.prototype.$onInit = function () {
            this.onInit();
        };
        FeedNIFIController.prototype.onInit = function () {
            var _this = this;
            if (this.versions) {
                this.$scope.$watch(function () {
                    return _this.FeedService.versionFeedModel;
                }, function (newVal) {
                    _this.versionFeedModel = _this.FeedService.versionFeedModel;
                });
            }
            this.$scope.$watch(function () {
                return _this.FeedService.editFeedModel;
            }, function (newVal) {
                //only update the model if it is not set yet
                if (_this.model == null) {
                    _this.model = angular.copy(_this.FeedService.editFeedModel);
                }
                //tell the ui what properties to show/hide
                var renderGetTableData = _this.FeedDetailsProcessorRenderingHelper.updateGetTableDataRendering(_this.model.inputProcessor, _this.model.nonInputProcessors);
                _this.updateControllerServiceProperties();
            });
            var inputProcessorIdWatch = this.$scope.$watch(function () {
                return _this.editModel.inputProcessorId;
            }, function (newVal) {
                _this.updateInputProcessor(newVal);
            });
            //Apply the entity access permissions
            this.$q.when(this.AccessControlService.hasPermission(this.AccessControlService.FEEDS_EDIT, this.model, this.AccessControlService.ENTITY_ACCESS.FEED.EDIT_FEED_DETAILS)).then(function (access) {
                _this.allowEdit = !_this.versions && access && !_this.model.view.feedDetails.disabled;
            });
        };
        /**
         * Edit the data
         */
        FeedNIFIController.prototype.onEdit = function () {
            //copy the model
            var inputProcessors = angular.copy(this.FeedService.editFeedModel.inputProcessors);
            var nonInputProcessors = angular.copy(this.FeedService.editFeedModel.nonInputProcessors);
            this.editModel = {};
            var allInputProperties = _.filter(this.model.properties, function (property) {
                return property.inputProperty == true;
            });
            var allInputProcessorProperties = _.groupBy(allInputProperties, function (property) {
                return property.processorId;
            });
            var allInputProcessorProperties = angular.copy(allInputProcessorProperties);
            this.editModel.allInputProcessorProperties = allInputProcessorProperties;
            this.editModel.inputProcessors = inputProcessors;
            this.editModel.nonInputProcessors = nonInputProcessors;
            // Find controller services
            _.chain(this.editModel.inputProcessors.concat(this.editModel.nonInputProcessors))
                .pluck("properties")
                .flatten(true)
                .filter(function (property) {
                return angular.isObject(property.propertyDescriptor) && angular.isString(property.propertyDescriptor.identifiesControllerService);
            })
                .each(this.FeedService.findControllerServicesForProperty);
            //NEED TO COPY IN TABLE PROPS HERE
            this.editModel.table = angular.copy(this.FeedService.editFeedModel.table);
            this.EditFeedNifiPropertiesService.editFeedModel = this.editModel;
            if (angular.isDefined(this.model.inputProcessor)) {
                this.updateInputProcessor(this.model.inputProcessor.processorId);
                this.editModel.inputProcessorId = this.model.inputProcessor.processorId;
            }
        };
        ;
        /**
         * Cancel an Edit
         */
        FeedNIFIController.prototype.onCancel = function () {
        };
        ;
        /**
         * Save the editModel
         * @param ev
         */
        FeedNIFIController.prototype.onSave = function (ev) {
            var _this = this;
            this.FeedService.showFeedSavingDialog(ev, this.$filter('translate')('views.feed-nifi-properties.Saving'), this.model.feedName);
            var copy = angular.copy(this.FeedService.editFeedModel);
            copy.inputProcessors = this.editModel.inputProcessors;
            copy.nonInputProcessors = this.editModel.nonInputProcessors;
            copy.inputProcessorId = this.editModel.inputProcessorId;
            copy.inputProcessor = this.editModel.inputProcessor;
            copy.inputProcessorType = this.editModel.inputProcessorType;
            copy.userProperties = null;
            //Server may have updated value. Don't send via UI.
            copy.historyReindexingStatus = undefined;
            //table type is edited here so need to update that prop as well
            copy.table.tableType = this.editModel.table.tableType;
            if (copy.table.incrementalDateField) {
                var dateProperty = this.findIncrementalDateFieldProperty();
                if (dateProperty) {
                    dateProperty.value = this.editModel.table.incrementalDateField;
                }
                copy.table.incrementalDateField = this.editModel.table.incrementalDateField;
            }
            //update the db properties
            this.FeedService.saveFeedModel(copy).then(function (response) {
                _this.FeedService.hideFeedSavingDialog();
                _this.editableSection = false;
                _this.model.inputProcessors = _this.editModel.inputProcessors;
                _this.model.nonInputProcessors = _this.editModel.nonInputProcessors;
                _this.model.inputProcessorId = _this.editModel.inputProcessorId;
                _this.model.inputProcessor = _this.editModel.inputProcessor;
                _this.model.table.tableType = _this.editModel.table.tableType;
                _this.model.table.incrementalDateField = _this.editModel.table.incrementalDateField;
                _this.model.inputProcessorType = _this.editModel.inputProcessorType;
                _this.FeedPropertyService.updateDisplayValueForProcessors(_this.model.inputProcessors);
                _this.FeedPropertyService.updateDisplayValueForProcessors(_this.model.nonInputProcessors);
                _this.updateControllerServiceProperties();
                //update the displayValue
                //Get the updated value from the server.
                _this.model.historyReindexingStatus = response.data.feedMetadata.historyReindexingStatus;
            }, function (response) {
                _this.FeedService.hideFeedSavingDialog();
                console.log('ERRORS were found ', response);
                _this.FeedService.buildErrorData(_this.model.feedName, response);
                _this.FeedService.showFeedErrorsDialog();
                //make it editable
                _this.editableSection = true;
            });
        };
        ;
        /**
         * add the select options to controller services
         */
        FeedNIFIController.prototype.updateControllerServiceProperties = function () {
            var _this = this;
            _.filter(this.model.nonInputProcessors, function (processor) {
                if (processor && processor.properties) {
                    var props = _.filter(processor.properties, function (property) {
                        if (_this.isControllerServiceProperty(property)) {
                            _this.setControllerServicePropertyDisplayName(property);
                            return true;
                        }
                    });
                    return true;
                }
            });
            _.filter(this.model.inputProcessor, function (processor) {
                if (processor && processor.properties) {
                    var props = _.filter(processor.properties, function (property) {
                        if (_this.isControllerServiceProperty(property)) {
                            _this.setControllerServicePropertyDisplayName(property);
                            return true;
                        }
                    });
                    return true;
                }
            });
        };
        /**
         * determine if a property is a controller service
         * @param property
         * @returns {boolean}
         */
        FeedNIFIController.prototype.isControllerServiceProperty = function (property) {
            var controllerService = property.propertyDescriptor.identifiesControllerService;
            if (controllerService != null && controllerService != undefined && controllerService != '') {
                return true;
            }
            return false;
        };
        /**
         * add the proper select values to controller services
         * @param property
         */
        FeedNIFIController.prototype.setControllerServicePropertyDisplayName = function (property) {
            var controllerService = property.propertyDescriptor.identifiesControllerService;
            if (controllerService != null && controllerService != undefined && controllerService != '') {
                //fetch the name
                var promise = this.$http.get(this.RestUrlService.GET_CONTROLLER_SERVICE_URL(property.value));
                promise.then(function (response) {
                    if (response && response.data) {
                        property.displayValue = response.data.name;
                        //set the allowable values on the property
                        if (property.propertyDescriptor.allowableValues == null) {
                            property.propertyDescriptor.allowableValues = [];
                            property.propertyDescriptor.allowableValues.push({ value: property.value, displayName: property.displayValue });
                        }
                    }
                }, function (err) {
                    //unable to fetch controller service... the id will display
                });
            }
        };
        FeedNIFIController.prototype.findProperty = function (key) {
            return _.find(this.model.allProperties, function (property) {
                //return property.key = 'Source Database Connection';
                return property.key == key;
            });
        };
        FeedNIFIController.prototype.findIncrementalDateFieldProperty = function () {
            return this.findProperty(this.INCREMENTAL_DATE_PROPERTY_KEY);
        };
        FeedNIFIController.prototype.updateInputProcessor = function (newVal) {
            var _this = this;
            angular.forEach(this.editModel.inputProcessors, function (processor) {
                if (processor.processorId == newVal) {
                    //check the type and return the custom form if there is one via a factory
                    var renderGetTableData = _this.FeedDetailsProcessorRenderingHelper.updateGetTableDataRendering(processor, _this.editModel.nonInputProcessors);
                    if (renderGetTableData) {
                        _this.model.table.method = 'EXISTING_TABLE';
                    }
                    _this.editModel.inputProcessor = processor;
                    _this.editModel.inputProcessorType = processor.type;
                    return false;
                }
            });
        };
        FeedNIFIController.prototype.diff = function (path) {
            return this.FeedService.diffOperation(path);
        };
        FeedNIFIController.$inject = ["$scope", "$http", "$q", "RestUrlService", "AccessControlService", "EntityAccessControlService", "FeedService", "EditFeedNifiPropertiesService", "FeedInputProcessorOptionsFactory", "FeedDetailsProcessorRenderingHelper", "BroadcastService", "FeedPropertyService", "$filter"];
        return FeedNIFIController;
    }());
    exports.FeedNIFIController = FeedNIFIController;
    angular.module(moduleName).controller('FeedNifiPropertiesController', FeedNIFIController);
    angular.module(moduleName)
        .directive('thinkbigFeedNifiProperties', directive);
});
//# sourceMappingURL=feed-nifi-properties.js.map