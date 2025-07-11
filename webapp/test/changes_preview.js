//This file used only for loading the changes in the preview and not required to be checked in.
//Load the fake lrep connector only if ui5 version < 1.78
var version = sap.ui.version.split('.');
if (parseInt(version[0]) <= 1 && parseInt(version[1]) < 78) {
    sap.ui.getCore().loadLibraries(['sap/ui/fl']);
    sap.ui.require(['sap/ui/fl/FakeLrepConnector'], function(FakeLrepConnector) {
        jQuery.extend(FakeLrepConnector.prototype, {
            create: function(oChange) {
                return Promise.resolve();
            },
            stringToAscii: function(sCodeAsString) {
                if (!sCodeAsString || sCodeAsString.length === 0) {
                    return '';
                }
                var sAsciiString = '';
                for (var i = 0; i < sCodeAsString.length; i++) {
                    sAsciiString += sCodeAsString.charCodeAt(i) + ',';
                }
                if (
                    sAsciiString !== null &&
                    sAsciiString.length > 0 &&
                    sAsciiString.charAt(sAsciiString.length - 1) === ','
                ) {
                    sAsciiString = sAsciiString.substring(0, sAsciiString.length - 1);
                }
                return sAsciiString;
            },
            /*
             * Get the content of the sap-ui-cachebuster-info.json file
             * to get the paths to the changes files
             * and get their content
             */
            loadChanges: function() {
                var oResult = {
                    changes: [],
                    settings: {
                        isKeyUser: true,
                        isAtoAvailable: false,
                        isProductiveSystem: false
                    }
                };

                //Get the content of the changes folder.
                var aPromises = [];
                var sCacheBusterFilePath = '/sap-ui-cachebuster-info.json';
                var trustedHosts = [/^localhost$/, /^.*.applicationstudio.cloud.sap$/];
                var url = new URL(window.location.toString());
                var isValidHost = trustedHosts.some((host) => {
                    return host.test(url.hostname);
                });
                /*eslint-disable promise/avoid-new*/
                /*eslint-disable promise/catch-or-return*/
                /*eslint-disable promise/always-return*/
                /*eslint-disable promise/no-nesting*/
                /*eslint-disable consistent-return*/
                /*eslint-disable xss/no-mixed-html*/
                return new Promise(function(resolve, reject) {
                    if (!isValidHost) reject(console.log('cannot load flex changes: invalid host'));
                    $.ajax({
                        url: url.origin + sCacheBusterFilePath,
                        type: 'GET',
                        cache: false
                    })
                        .then(function(oCachebusterContent) {
                            //we are looking for only change files
                            var aChangeFilesPaths = Object.keys(oCachebusterContent).filter(function(sPath) {
                                return sPath.endsWith('.change');
                            });
                            $.each(aChangeFilesPaths, function(index, sFilePath) {
                                //now as we support MTA projects we need to take only changes which are relevant for
                                //the current HTML5 module
                                //sap-ui-cachebuster-info.json for MTA doesn't start with "webapp/changes" but from <MTA-HTML5-MODULE-NAME>
                                //possible change file path patterns
                                //webapp/changes/<change-file>
                                //<MTA-HTML5-MODULE-NAME>/webapp/changes/<change-file>
                                if (sFilePath.indexOf('changes') === 0) {
                                    /*eslint-disable no-param-reassign*/
                                    if (!isValidHost) reject(console.log('cannot load flex changes: invalid host'));
                                    aPromises.push(
                                        $.ajax({
                                            url: url.origin + '/' + sFilePath,
                                            type: 'GET',
                                            cache: false
                                        }).then(function(sChangeContent) {
                                            return JSON.parse(sChangeContent);
                                        })
                                    );
                                }
                            });
                        })
                        .always(function() {
                            return Promise.all(aPromises).then(function(aChanges) {
                                return new Promise(function(resolve, reject) {
                                    // If no changes found, maybe because the app was executed without doing a build.
                                    // Check for changes folder and load the changes, if any.
                                    if (aChanges.length === 0) {
                                        if (!isValidHost) reject(console.log('cannot load flex changes: invalid host'));
                                        $.ajax({
                                            url: url.origin + '/changes/',
                                            type: 'GET',
                                            cache: false
                                        })
                                            .then(function(sChangesFolderContent) {
                                                var regex = /(\/changes\/[^"]*\.change)/g;
                                                var result = regex.exec(sChangesFolderContent);

                                                while (result !== null) {
                                                    if (!isValidHost)
                                                        reject(console.log('cannot load flex changes: invalid host'));
                                                    aPromises.push(
                                                        $.ajax({
                                                            url: url.origin + result[1],
                                                            type: 'GET',
                                                            cache: false
                                                        }).then(function(sChangeContent) {
                                                            return JSON.parse(sChangeContent);
                                                        })
                                                    );
                                                    result = regex.exec(sChangesFolderContent);
                                                }
                                                resolve(Promise.all(aPromises));
                                            })
                                            .fail(function(obj) {
                                                // No changes folder, then just resolve
                                                resolve(aChanges);
                                            });
                                    } else {
                                        resolve(aChanges);
                                    }
                                }).then(function(aChanges) {
                                    var aChangePromises = [],
                                        aProcessedChanges = [];
                                    aChanges.forEach(function(oChange) {
                                        var sChangeType = oChange.changeType;
                                        if (sChangeType === 'addXML' || sChangeType === 'codeExt') {
                                            /*eslint-disable no-nested-ternary*/
                                            var sPath =
                                                sChangeType === 'addXML'
                                                    ? oChange.content.fragmentPath
                                                    : sChangeType === 'codeExt'
                                                    ? oChange.content.codeRef
                                                    : '';
                                            var sWebappPath = sPath.match(/webapp(.*)/);
                                            var sUrl = '/' + sWebappPath[0];
                                            aChangePromises.push(
                                                $.ajax({
                                                    url: sUrl,
                                                    type: 'GET',
                                                    cache: false
                                                }).then(function(oFileDocument) {
                                                    if (sChangeType === 'addXML') {
                                                        oChange.content.fragment = FakeLrepConnector.prototype.stringToAscii(
                                                            oFileDocument.documentElement.outerHTML
                                                        );
                                                        oChange.content.selectedFragmentContent =
                                                            oFileDocument.documentElement.outerHTML;
                                                    } else if (sChangeType === 'codeExt') {
                                                        oChange.content.code = FakeLrepConnector.prototype.stringToAscii(
                                                            oFileDocument
                                                        );
                                                        oChange.content.extensionControllerContent = oFileDocument;
                                                    }
                                                    return oChange;
                                                })
                                            );
                                        } else {
                                            aProcessedChanges.push(oChange);
                                        }
                                    });
                                    // aChanges holds the content of all change files from the project (empty array if no such files)
                                    // sort the array by the creation timestamp of the changes
                                    if (aChangePromises.length > 0) {
                                        return Promise.all(aChangePromises).then(function(aUpdatedChanges) {
                                            aUpdatedChanges.forEach(function(oChange) {
                                                aProcessedChanges.push(oChange);
                                            });
                                            aProcessedChanges.sort(function(change1, change2) {
                                                return new Date(change1.creation) - new Date(change2.creation);
                                            });
                                            oResult.changes = aProcessedChanges;
                                            var oLrepChange = {
                                                changes: oResult,
                                                componentClassName: 'gd.md.alpproject'
                                            };
                                            resolve(oLrepChange);
                                        });
                                    } else {
                                        aProcessedChanges.sort(function(change1, change2) {
                                            return new Date(change1.creation) - new Date(change2.creation);
                                        });
                                        oResult.changes = aProcessedChanges;
                                        var oLrepChange = {
                                            changes: oResult,
                                            componentClassName: 'gd.md.alpproject'
                                        };
                                        resolve(oLrepChange);
                                    }
                                });
                            });
                        });
                });
            }
        });
        FakeLrepConnector.enableFakeConnector();
    });
}
