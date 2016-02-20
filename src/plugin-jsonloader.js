"use strict";

angular.module("jtt_aping_jsonloader", [])
    .directive('apingJsonloader', ['apingUtilityHelper', 'jsonloaderFactory', '$q', 'jsonloaderResults', function (apingUtilityHelper, jsonloaderFactory, $q, jsonloaderResults) {
        return {
            require: '?aping',
            restrict: 'A',
            replace: 'false',
            link: function (scope, element, attrs, apingController) {

                this.load = function () {
                    var appSettings = apingController.getAppSettings();
                    var requests = apingUtilityHelper.parseJsonFromAttributes(attrs.apingJsonloader, "jsonloader", appSettings);

                    scope.executeRequests(requests, appSettings)
                        .then(function (results) {
                            angular.forEach(results, function (value, key) {
                                apingController.concatToResults(jsonloaderResults.getResults(value));
                            });
                        });
                };

                this.load();

            },
            controller: function ($scope) {

                $scope.executeRequests = function (_requests, _appSettings) {

                    var deferred = $q.defer();

                    var deferreds = [];

                    _requests.forEach(function (request) {

                        if (angular.isUndefined(request.items)) {
                            request.items = _appSettings.items;
                        }

                        deferreds.push($scope.executeSingleRequest(request));
                    });

                    var resultArray = [];

                    $q.all(deferreds)
                        .then(function (_data) {
                            angular.forEach(_data, function (value, key) {
                                if (angular.isDefined(value.data) && angular.isDefined(value.data.data) && angular.isDefined(value.data.data.results)) {
                                    resultArray.push(value);
                                }
                            });
                            deferred.resolve(resultArray);
                        });

                    return deferred.promise;
                };

                $scope.executeSingleRequest = function (_request) {
                    var deferred = $q.defer();

                    if (_request.path) {
                        //create requestObject for factory function call
                        var requestObject = {
                            path: _request.path,
                        };

                        if (!_request.format || _request.format.toLowerCase() !== "jsonp") {
                            requestObject.format = "json";
                        } else {
                            requestObject.format = "jsonp";
                        }

                        if (_request.items === 0 || _request.items === '0') {
                            deferred.resolve({});
                        }

                        // -1 is "no explicit limit". same for NaN value
                        if (_request.items < 0 || isNaN(_request.items)) {
                            _request.items = undefined;
                        }

                        if (angular.isDefined(_request.orderBy) && !angular.isString(_request.orderBy)) {
                            _request.orderBy = undefined;
                        }

                        if (angular.isDefined(_request.orderReverse) && (_request.orderReverse === true || _request.orderReverse === 'true')) {
                            _request.orderReverse = true;
                        }
                        jsonloaderFactory.getJsonData(requestObject)

                            .then(function (_data) {

                                deferred.resolve({
                                    data: _data,
                                    request: _request,
                                    requestObject: requestObject
                                });

                            })
                            .catch(function (_error) {
                                deferred.resolve({
                                    data: undefined,
                                    request: _request,
                                    requestObject: requestObject
                                });
                            });

                    } else {
                        deferred.resolve({});
                    }


                    return deferred.promise;
                }
            }
        }
    }])
    .factory('jsonloaderFactory', ['$http', function ($http) {
        var jsonloaderFactory = {};

        jsonloaderFactory.getJsonData = function (_requestObject) {
            var params = {};

            if (_requestObject.format === "jsonp") {

                return $http.jsonp(
                    _requestObject.path,
                    {
                        method: 'GET',
                        params: {callback: "JSON_CALLBACK"},
                    }
                );

                /*
                 return $http({
                 method: 'JSONP',
                 url: _requestObject.path,
                 params: {callback: "JSON_CALLBACK"'},
                 });
                 */

            } else {
                return $http({
                    method: 'GET',
                    url: _requestObject.path,
                    params: params
                });
            }
        };
        return jsonloaderFactory;
    }])
    .service('jsonloaderResults', ['apingUtilityHelper', function (apingUtilityHelper) {
        this.getResults = function (_result) {
            var resultArray = [];

            if (_result.data && _result.data.data) {

                var results = _result.data.data;
                var request = _result.request;

                if (angular.isDefined(request.resultProperty)) {
                    results = apingUtilityHelper.getValueFromObjectByPropertyString(_result.data.data, request.resultProperty, false);
                }

                if (_result.data.data.constructor !== Array) {
                    resultArray.push(results);
                } else {
                    angular.extend(resultArray, results);

                    if (angular.isDefined(request.orderBy)) {
                        if (request.orderBy === "$RANDOM") {
                            resultArray = apingUtilityHelper.shuffleArray(resultArray);
                        } else {
                            resultArray.sort(apingUtilityHelper.sortArrayByProperty(request.orderBy));
                        }
                    }
                    //order desc
                    if (angular.isDefined(request.orderReverse) && request.orderReverse === true && request.orderBy !== "$RANDOM") {
                        resultArray.reverse();
                    }

                    if (angular.isUndefined(request.items)) {
                        resultArray = results;
                    } else {
                        //crop spare
                        if (request.items > 0 && resultArray.length > request.items) {
                            resultArray = resultArray.splice(0, request.items);
                        }
                    }
                }
            }
            return resultArray;
        }
    }]);