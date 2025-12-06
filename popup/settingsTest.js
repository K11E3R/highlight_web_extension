/**
 * Settings Test Suite
 * Comprehensive tests for all settings functionality
 */

class SettingsTest {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  log(test, status, message = '') {
    const result = { test, status, message, timestamp: Date.now() };
    this.results.push(result);
    if (status === 'pass') this.passed++;
    if (status === 'fail') this.failed++;
    console.log(`[${status.toUpperCase()}] ${test}${message ? ': ' + message : ''}`);
  }

  async test(name, fn) {
    try {
      await fn();
      this.log(name, 'pass');
      return true;
    } catch (e) {
      this.log(name, 'fail', e.message);
      return false;
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Settings Test Suite...\n');
    this.results = [];
    this.passed = 0;
    this.failed = 0;

    // Wait a bit for popup to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 1: Settings Object Exists
    await this.test('Settings object exists', () => {
      const state = window.getState ? window.getState() : null;
      this.assert(state && state.settings, 'state.settings not found');
      this.assert(typeof state.settings === 'object', 'settings is not an object');
    });

    // Get state once for all tests
    const state = window.getState ? window.getState() : {};

    // Test 2: All Display Settings Exist
    await this.test('Display settings exist', () => {
      const required = ['expandDefault', 'showNotePreview', 'showUrl', 'showTimestamp', 'showWordCount', 'cardAnimation'];
      required.forEach(key => {
        this.assert(key in state.settings, `Missing setting: ${key}`);
      });
    });

    // Test 3: All Behavior Settings Exist
    await this.test('Behavior settings exist', () => {
      const required = ['quickModeEffects', 'confirmDelete', 'autoSave', 'clickToOpen'];
      required.forEach(key => {
        this.assert(key in state.settings, `Missing setting: ${key}`);
      });
    });

    // Test 4: All Filter Settings Exist
    await this.test('Filter settings exist', () => {
      const required = ['enableColorFilter', 'enableCategoryFilter', 'enableDateFilter', 'enableSearch', 'enableSort'];
      required.forEach(key => {
        this.assert(key in state.settings, `Missing setting: ${key}`);
      });
    });

    // Test 5: Default Values Exist
    await this.test('Default values exist', () => {
      this.assert('defaultColor' in state.settings, 'Missing defaultColor');
      this.assert('defaultCategory' in state.settings, 'Missing defaultCategory');
    });

    // Test 6: Settings Persistence (Save)
    await this.test('Settings can be saved', async () => {
      const testValue = { test: 'value_' + Date.now() };
      await chrome.storage.local.set({ testSettings: testValue });
      const result = await chrome.storage.local.get('testSettings');
      this.assert(result.testSettings && result.testSettings.test === testValue.test, 'Save failed');
      await chrome.storage.local.remove('testSettings');
    });

    // Test 7: Settings Persistence (Load)
    await this.test('Settings can be loaded', async () => {
      const testValue = { test: 'value_' + Date.now() };
      await chrome.storage.local.set({ testSettings: testValue });
      const result = await chrome.storage.local.get('testSettings');
      this.assert(result.testSettings !== undefined, 'Load failed');
      await chrome.storage.local.remove('testSettings');
    });

    // Test 8: Toggle Elements Exist
    await this.test('Toggle elements exist', () => {
      const toggleIds = [
        'settingExpandDefault', 'settingShowNotePreview', 'settingShowUrl',
        'settingShowTimestamp', 'settingShowWordCount', 'settingCardAnimation',
        'settingQuickModeEffects', 'settingConfirmDelete', 'settingAutoSave', 'settingClickToOpen',
        'settingEnableColorFilter', 'settingEnableCategoryFilter', 'settingEnableDateFilter',
        'settingEnableSearch', 'settingEnableSort'
      ];
      toggleIds.forEach(id => {
        const el = document.getElementById(id);
        this.assert(el !== null, `Toggle element ${id} not found`);
      });
    });

    // Test 9: Color Picker Elements Exist
    await this.test('Color picker exists', () => {
      const colorPicks = document.querySelectorAll('.color-pick');
      this.assert(colorPicks.length === 5, `Expected 5 color picks, found ${colorPicks.length}`);
    });

    // Test 10: Settings Modal Exists
    await this.test('Settings modal exists', () => {
      const modal = document.getElementById('settingsModal');
      this.assert(modal !== null, 'Settings modal not found');
      // Don't check if hidden - it might be open during testing
    });

    // Test 11: Filter Containers Exist
    await this.test('Filter containers exist', () => {
      const containers = {
        color: document.querySelector('.color-pills'),
        category: document.querySelector('.category-tabs'),
        date: document.querySelector('.date-filter'),
        search: document.querySelector('.search-bar')
      };
      Object.entries(containers).forEach(([name, el]) => {
        this.assert(el !== null, `${name} filter container not found`);
      });
    });

    // Test 12: Toggle Function Works
    await this.test('Toggle function works', () => {
      const colorFilter = document.querySelector('.color-pills');
      const initialDisplay = colorFilter.style.display;
      
      // Test hide
      window.toggleFilter('color', false);
      this.assert(colorFilter.parentElement.style.display === 'none', 'Filter not hidden');
      
      // Test show
      window.toggleFilter('color', true);
      this.assert(colorFilter.parentElement.style.display !== 'none', 'Filter not shown');
    });

    // Test 13: Settings Functions Exist
    await this.test('Settings functions exist', () => {
      const functions = ['loadSettings', 'saveSettings', 'applySettingsToUI', 'setupSettingsHandlers', 'toggleFilter'];
      functions.forEach(fn => {
        this.assert(typeof window[fn] === 'function', `Function ${fn} not found`);
      });
    });

    // Test 14: Default Color Validation
    await this.test('Default color is valid', () => {
      const validColors = ['#ffd43b', '#51cf66', '#4dabf7', '#9775fa', '#ff6ba7'];
      this.assert(validColors.includes(state.settings.defaultColor), 'Invalid default color');
    });

    // Test 15: Boolean Settings Validation
    await this.test('Boolean settings are valid', () => {
      const boolSettings = [
        'expandDefault', 'showNotePreview', 'showUrl', 'showTimestamp', 'showWordCount', 'cardAnimation',
        'quickModeEffects', 'confirmDelete', 'autoSave', 'clickToOpen',
        'enableColorFilter', 'enableCategoryFilter', 'enableDateFilter', 'enableSearch', 'enableSort'
      ];
      boolSettings.forEach(key => {
        this.assert(typeof state.settings[key] === 'boolean', `${key} is not boolean`);
      });
    });

    // Test 16: Card Animation Class Toggle
    await this.test('Card animation class toggles', () => {
      const body = document.body;
      const originalSetting = state.settings.cardAnimation;
      
      // Test disable
      state.settings.cardAnimation = false;
      window.applySettingsToUI();
      this.assert(body.classList.contains('no-animations'), 'no-animations class not added');
      
      // Test enable
      state.settings.cardAnimation = true;
      window.applySettingsToUI();
      this.assert(!body.classList.contains('no-animations'), 'no-animations class not removed');
      
      // Restore
      state.settings.cardAnimation = originalSetting;
      window.applySettingsToUI();
    });

    // Test 17: Settings Modal Open/Close
    await this.test('Settings modal can open/close', () => {
      const modal = document.getElementById('settingsModal');
      
      window.openSettingsModal();
      this.assert(!modal.classList.contains('hidden'), 'Modal not opened');
      
      window.closeSettingsModal();
      this.assert(modal.classList.contains('hidden'), 'Modal not closed');
    });

    // Test 18: Reset Settings Button
    await this.test('Reset settings button exists', () => {
      const resetBtn = document.getElementById('resetSettingsBtn');
      this.assert(resetBtn !== null, 'Reset button not found');
      this.assert(resetBtn.textContent.includes('Reset'), 'Reset button has wrong text');
    });

    // Test 19: All 20 Settings Count
    await this.test('All 20 settings present', () => {
      const settingsCount = Object.keys(state.settings).length;
      this.assert(settingsCount === 20, `Expected 20 settings, found ${settingsCount}`);
    });

    // Test 20: Settings Structure Validation
    await this.test('Settings structure is valid', () => {
      const settings = state.settings;
      // Check no undefined or null values
      Object.entries(settings).forEach(([key, value]) => {
        this.assert(value !== undefined, `${key} is undefined`);
        this.assert(value !== null, `${key} is null`);
      });
    });

    // Generate report
    return this.generateReport();
  }

  generateReport() {
    const total = this.passed + this.failed;
    const percentage = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${percentage}%`);
    console.log('='.repeat(50) + '\n');

    return {
      total,
      passed: this.passed,
      failed: this.failed,
      percentage,
      results: this.results,
      success: this.failed === 0
    };
  }

  generateHTML() {
    const report = this.generateReport();
    
    let html = `
      <div class="test-results">
        <div class="test-summary ${report.success ? 'success' : 'failure'}">
          <div class="test-icon">${report.success ? '✅' : '❌'}</div>
          <div class="test-stats">
            <h3>${report.success ? 'All Tests Passed!' : 'Some Tests Failed'}</h3>
            <p>${report.passed} / ${report.total} tests passed (${report.percentage}%)</p>
          </div>
        </div>
        <div class="test-list">
    `;

    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✓' : '✗';
      const statusClass = result.status === 'pass' ? 'test-pass' : 'test-fail';
      html += `
        <div class="test-item ${statusClass}">
          <span class="test-icon">${icon}</span>
          <div class="test-content">
            <span class="test-name">${result.test}</span>
            ${result.message ? `<span class="test-message">${result.message}</span>` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }
}

// Make test available globally
window.SettingsTest = SettingsTest;

// Auto-run tests when loaded
if (typeof window !== 'undefined') {
  console.log('✅ Settings test suite loaded. Tests will auto-run on popup init or manually via: new SettingsTest().runAllTests()');
}

