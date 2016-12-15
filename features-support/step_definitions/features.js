'use strict';

var should = require('should');
var By = require('selenium-webdriver').By;

const pageLoadTimeout = 30 * 1000;
const timeoutObject = {timeout: pageLoadTimeout};

// Deal with the non-standard webdriver promises.
function handleErr(cb) {
  return function(err) {
    cb(err);
  };
}

/**
 * Given parameters on the world object, load a URL.
 * @param  {Function} callback Cucumber done callback OR a custom callback.
 * @return {undefined}
 * @this World
 */
function getProjectFromUrl(callback) {
  var world = this;
  var projectRetrievalUrl = 'http://localhost:' + world.appPort + '/?repo_url=' + encodeURIComponent(world.repoUrl);

  world.browser.get(projectRetrievalUrl)
    .then(world.browser.getPageSource.bind(world.browser), handleErr(callback))
    .then(function (body) {
      world.body = body;
      callback();
    }, handleErr(callback));
}

// The returned function is passed as a callback to getProjectFromUrl.
function getScenarioFromProject(callback, world) {
  return function(error) {
    if (error) {
      callback(error);
      return;
    }

    world.browser.findElements(By.css('.spec-link'))
      .then(function (specLinks) {
        var featureLink = specLinks[specLinks.length - 1];
        return world.browser.get(featureLink.getAttribute('href'));
      }, handleErr(callback))
      .then(world.browser.getPageSource.bind(world.browser), handleErr(callback))
      .then(function (body) {
        world.body = body;
        callback();
      }, handleErr(callback));
  };
}

module.exports = function () {

  this.Given(/^a URL representing a remote Git repo "([^"]*)"$/, function (repoUrl, callback) {
    this.repoUrl = repoUrl;
    callback();
  });


  this.When(/^an interested party wants to view the features in that repo\.?$/, timeoutObject, getProjectFromUrl);
  this.When(/^they request the features for the same repository again\.?$/, timeoutObject, getProjectFromUrl);
  this.When(/^an interested party wants to view the scenarios within a feature\.?$/, timeoutObject, function (callback) {
    var world = this;
    getProjectFromUrl.bind(world)(getScenarioFromProject(callback, world));
  });

  this.When(/^interested party wants to view HTML features in the repo$/, timeoutObject, function (callback) {
    this.browser.find(By.className('spec-link'))
        .then(function () {
          callback();
        });
  });

  this.When(/^they decide to change which branch is being displayed$/, function (callback) {
    var world = this;
    var burgerMenuId = 'expand-collapse-repository-controls';
    var repositoryCongtrolsId = 'repository-controls';
    var projectShaElId = 'project-commit';
    var changeBranchSelectElId = 'change-branch-control';
    var testingBranchOptionValue = 'refs%2Fremotes%2Forigin%2Ftest%2FdoNotDelete';
    var burgerMenuEl;
    var repoControlsEl;


    // Get the burger menu element.
    world.browser.findElement(By.id(burgerMenuId))
      .then(function(_burgerMenuEl) {
        burgerMenuEl = _burgerMenuEl;
        return world.browser.findElement(By.id(repositoryCongtrolsId));

        // Get the repo controls element.
      })
      .then(function(_repoControlsEl) {
        repoControlsEl = _repoControlsEl;
        return repoControlsEl.getAttribute('class');

        // Open the repo controls.
      })
      .then(function(repoControlsClass) {
        var isClosed = repoControlsClass.indexOf('collapse') !== -1;
        if (isClosed) {
          return burgerMenuEl.click();
        }
        return;

        // Grab the current SHA
      })
      .then(function() {
        return world.browser.findElement(By.id(projectShaElId));
      })
      .then(function(_projectShaEl) {
        return _projectShaEl.getText();
      })
      .then(function(originalSha) {
        world.oringalSha = originalSha;

        // Grab the branch selecting control.
        return world.browser.findElement(By.id(changeBranchSelectElId));

        // Request to change branch.
      })
      .then(function(_changeBranchSelectEl) {
        return _changeBranchSelectEl.findElement(By.xpath('option[@value=\'' + testingBranchOptionValue + '\']'));
      })
      .then(function(_testBranchOptionEl) {
        return _testBranchOptionEl.click();
      })
      .then(function () {
        callback();
      })
      .catch(function () {
        handleErr(callback);
      });
  });


  this.Then(/^the list of features will be visible\.?$/, function () {
    should.equal(
      /\.feature/i.test(this.body) && /\.md/i.test(this.body),
      true,
      'The returned document body does not contain the strings \'.feature\' and \'.md\'' + this.body);
  });

  this.Then(/^the scenarios will be visible\.?$/, function () {
    should.equal(/feature-title/i.test(this.body),
      true,
      'The returned document body does not contain a feature title');
  });

  // This has to wait for a page to load so it gets the page load time out.
  this.Then(/^the files from the selected branch are displayed\.$/, timeoutObject, function (callback) {
    var world = this;

    var projectShaElId = 'project-commit';

    // Get the new SHA.
    world.browser.findElement(By.id(projectShaElId))
      .then(function(_projectShaEl) {
        return _projectShaEl.getText();
      }, handleErr(callback))
      .then(function(newSha) {
        should.notEqual(newSha, world.oringalSha, 'The SHA did not change on changing branch.');
        callback();
      }, handleErr(callback));
  });

  this.When(/^the results are retrieved from a CI server\.?$/, timeoutObject, function (callback) {
    var world = this;

    var getResultsID='get-jenkins-results';
    var getResults;
    // get the get results button
    world.browser.findElement(By.id(getResultsID))
      .then(function(_getResults) {
        getResults = _getResults;
        return getResults.click();
      }, handleErr(callback))
      .then(world.browser.findElement(By.id(getResultsID)))
      .then(
        getProjectFromUrl.bind(world)(
        getScenarioFromProject(callback, world)
      )
    );
  });

  this.Then(/^the list of results for the feature will be visible\.$/, timeoutObject, function (callback) {
    var world = this;
    world.browser.findElement(By.css('.resultLink .PASSED'))
      .then(function(_resultButton) {
        return _resultButton.getAttribute('value');
      }, handleErr(callback))
      .then(function(resultValue) {
        should.equal(resultValue, 'PASSED', 'The value of the button was not PASSED, value was '+resultValue);
        callback();
      }, handleErr(callback));
  });

  this.When(/^an interested party wants to view the results for the features in that repo$/, timeoutObject, getProjectFromUrl);

  this.Then(/^the get results button is displayed\.$/, timeoutObject, function (callback) {
    var world = this;
    world.browser.findElement(By.css('.get-results')).then(function() {
      should.equal(true,true);
    }, function(err) {
      if (err.name && err.name === 'NoSuchElementError') {
        // should.equal(false,true,'element not displayed');
        should.fail('Could not find a get results button');
      } else {
        should.fail('Got the following unexpected error - ' + err);
      }
    });
    callback();
  });




  this.When(/^they decide to view HTML specification$/, function (callback) {
    var world = this;

    world.browser.findElements(By.css('.spec-link[href*=\\.html]'))
        .then(function (specLinks) {
          var featureLink = specLinks[specLinks.length - 1];

          // Navigates to a feature file
          return world.browser.get(featureLink.getAttribute('href'));
        })
        .then(function () {
          callback();
        })
        .catch(function() {
          handleErr(callback);
        });
  });

  this.Then(/^HTML specification is displayed$/, function (callback) {
    var browser = this.browser;
    browser.findElement(By.css('section.html-body iframe'))
      .then(function (iframe) {
        return browser.switchTo().frame(iframe);
      })
      .then(function () {
        return browser.findElement(By.css('h1'));
      })
      .then(function (el) {
        return el.getText();
      })
      .then(function (h1Text) {
        should.equal(h1Text, 'Title');
        callback();
      })
      .catch(function () {
        handleErr(callback);
      });
  });

};