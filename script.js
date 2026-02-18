(function () {
  'use strict';

  var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  var GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  var LOCATION_NAME_GEO = 'Текущее местоположение';

  var weatherCodes = {
    0: 'Ясно',
    1: 'Преимущественно ясно',
    2: 'Переменная облачность',
    3: 'Пасмурно',
    45: 'Туман',
    48: 'Изморозь',
    51: 'Морось',
    53: 'Морось',
    55: 'Морось',
    61: 'Дождь',
    63: 'Дождь',
    65: 'Сильный дождь',
    71: 'Снег',
    73: 'Снег',
    75: 'Сильный снег',
    80: 'Ливень',
    81: 'Ливень',
    82: 'Сильный ливень',
    95: 'Гроза',
    96: 'Гроза с градом',
    99: 'Гроза с градом'
  };

  var state = {
    locations: [],
    currentIndex: 0,
    selectedSuggestion: null,
    dropdownDebounce: null
  };

  var dom = {};

  function getBySelector(sel) {
    return document.querySelector(sel);
  }

  function getById(id) {
    return document.getElementById(id);
  }

  function initDom() {
    dom.tabsList = getBySelector('.locations__tabs');
    dom.weatherLoading = getBySelector('.weather__state_loading');
    dom.weatherError = getBySelector('.weather__state_error');
    dom.weatherSuccess = getBySelector('.weather__state_success');
    dom.weatherLocation = getBySelector('.weather__location');
    dom.weatherDays = getBySelector('.weather__days');
    dom.btnRefresh = getBySelector('.btn_refresh');
    dom.btnAddCity = getBySelector('.btn_add-city');
    dom.modal = getById('modal-city');
    dom.formCity = getById('form-city');
    dom.inputCity = getById('input-city');
    dom.dropdown = getById('dropdown-cities');
    dom.inputCityError = getById('input-city-error');
    dom.modalClose = getBySelector('.modal__close');
    dom.modalBackdrop = getBySelector('.modal__backdrop');
  }

  function showWeatherState(which, message) {
    dom.weatherLoading.hidden = which !== 'loading';
    dom.weatherError.hidden = which !== 'error';
    dom.weatherSuccess.hidden = which !== 'success';
    if (which === 'error' && message) {
      var msgEl = dom.weatherError.querySelector('.weather__message');
      if (msgEl) msgEl.textContent = message;
    }
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return 'Сегодня';
    if (d.getTime() === tomorrow.getTime()) return 'Завтра';
    var options = { day: 'numeric', month: 'long' };
    return d.toLocaleDateString('ru-RU', options);
  }

  function weatherCodeToText(code) {
    return weatherCodes[code] || 'Облачно';
  }

  function renderForecast(locationName, daily) {
    dom.weatherLocation.textContent = locationName;
    dom.weatherDays.innerHTML = '';
    var count = Math.min(3, daily.time.length);
    for (var i = 0; i < count; i++) {
      var date = daily.time[i];
      var maxTemp = daily.temperature_2m_max[i];
      var minTemp = daily.temperature_2m_min[i];
      var code = daily.weathercode[i];
      var dayEl = document.createElement('div');
      dayEl.className = 'weather-day';
      dayEl.innerHTML =
        '<p class="weather-day__date">' + formatDate(date) + '</p>' +
        '<p class="weather-day__temp">' + Math.round(maxTemp) + '° / ' + Math.round(minTemp) + '°</p>' +
        '<p class="weather-day__desc">' + weatherCodeToText(code) + '</p>';
      dom.weatherDays.appendChild(dayEl);
    }
  }

  function fetchForecast(lat, lon) {
    var url = FORECAST_URL + '?latitude=' + encodeURIComponent(lat) +
      '&longitude=' + encodeURIComponent(lon) +
      '&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto';
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Ошибка загрузки погоды');
      return res.json();
    });
  }

  function loadWeatherForCurrent() {
    var loc = state.locations[state.currentIndex];
    if (!loc) return;
    showWeatherState('loading');
    fetchForecast(loc.lat, loc.lon)
      .then(function (data) {
        renderForecast(loc.name, data.daily);
        showWeatherState('success');
      })
      .catch(function (err) {
        showWeatherState('error', err.message || 'Не удалось загрузить погоду');
      });
  }

  function renderTabs() {
    dom.tabsList.innerHTML = '';
    state.locations.forEach(function (loc, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab' + (i === state.currentIndex ? ' tab_active' : '');
      btn.textContent = loc.name;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === state.currentIndex);
      btn.addEventListener('click', function () {
        state.currentIndex = i;
        renderTabs();
        loadWeatherForCurrent();
      });
      li.appendChild(btn);
      dom.tabsList.appendChild(li);
    });
  }

  function addLocation(name, lat, lon) {
    var id = 'loc-' + Date.now();
    state.locations.push({ id: id, name: name, lat: lat, lon: lon });
    state.currentIndex = state.locations.length - 1;
    renderTabs();
    loadWeatherForCurrent();
  }

  function openCityModal() {
    dom.modal.hidden = false;
    dom.inputCity.value = '';
    state.selectedSuggestion = null;
    hideDropdown();
    hideCityError();
    dom.inputCity.focus();
  }

  function closeCityModal() {
    dom.modal.hidden = true;
    hideDropdown();
  }

  function hideDropdown() {
    dom.dropdown.hidden = true;
    dom.dropdown.innerHTML = '';
  }

  function showCityError(message) {
    dom.inputCityError.textContent = message || '';
    dom.inputCityError.hidden = !message;
    dom.inputCity.classList.toggle('form-group__input_invalid', !!message);
  }

  function hideCityError() {
    showCityError('');
  }

  function fetchCitySuggestions(query) {
    if (!query || query.length < 2) return Promise.resolve([]);
    var url = GEOCODE_URL + '?name=' + encodeURIComponent(query) + '&count=5&language=ru';
    return fetch(url).then(function (res) {
      if (!res.ok) return [];
      return res.json();
    }).then(function (data) {
      return (data.results && data.results.length) ? data.results : [];
    }).catch(function () {
      return [];
    });
  }

  function showDropdown(results) {
    dom.dropdown.innerHTML = '';
    if (!results.length) {
      dom.dropdown.hidden = true;
      return;
    }
    results.forEach(function (r) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'form-group__dropdown-item';
      item.textContent = r.name + (r.admin1 ? ', ' + r.admin1 : '');
      item.addEventListener('click', function () {
        dom.inputCity.value = r.name;
        state.selectedSuggestion = { name: r.name, lat: r.latitude, lon: r.longitude };
        hideDropdown();
      });
      dom.dropdown.appendChild(item);
    });
    dom.dropdown.hidden = false;
  }

  function onCityInput() {
    state.selectedSuggestion = null;
    hideCityError();
    var query = dom.inputCity.value.trim();
    if (state.dropdownDebounce) clearTimeout(state.dropdownDebounce);
    if (query.length < 2) {
      hideDropdown();
      return;
    }
    state.dropdownDebounce = setTimeout(function () {
      state.dropdownDebounce = null;
      fetchCitySuggestions(query).then(showDropdown);
    }, 300);
  }

  function requestGeo() {
    if (!navigator.geolocation) {
      openCityModal();
      return;
    }
    showWeatherState('loading');
    navigator.geolocation.getCurrentPosition(
      function (position) {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        addLocation(LOCATION_NAME_GEO, lat, lon);
      },
      function () {
        showWeatherState('success');
        dom.weatherSuccess.hidden = true;
        openCityModal();
      }
    );
  }

  function geocodeCity(name) {
    var url = GEOCODE_URL + '?name=' + encodeURIComponent(name) + '&count=1&language=ru';
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Ошибка поиска города');
      return res.json();
    }).then(function (data) {
      if (!data.results || data.results.length === 0) {
        throw new Error('Город не найден');
      }
      var r = data.results[0];
      return { name: r.name, lat: r.latitude, lon: r.longitude };
    });
  }

  function onFormSubmit(e) {
    e.preventDefault();
    var name = dom.inputCity.value.trim();
    hideCityError();
    if (!name) {
      showCityError('Введите название города');
      return;
    }
    if (state.selectedSuggestion && state.selectedSuggestion.name === name) {
      addLocation(state.selectedSuggestion.name, state.selectedSuggestion.lat, state.selectedSuggestion.lon);
      closeCityModal();
      return;
    }
    showWeatherState('loading');
    geocodeCity(name)
      .then(function (geo) {
        addLocation(geo.name, geo.lat, geo.lon);
        closeCityModal();
      })
      .catch(function (err) {
        showWeatherState('success');
        dom.weatherSuccess.hidden = state.locations.length === 0;
        showCityError(err.message || 'Город не найден. Выберите город из списка.');
      });
  }

  function onRefresh() {
    if (state.locations.length === 0) return;
    loadWeatherForCurrent();
  }

  function init() {
    initDom();
    dom.btnRefresh.addEventListener('click', onRefresh);
    dom.btnAddCity.addEventListener('click', openCityModal);
    dom.formCity.addEventListener('submit', onFormSubmit);
    dom.inputCity.addEventListener('input', onCityInput);
    dom.inputCity.addEventListener('focus', function () {
      if (dom.inputCity.value.trim().length >= 2 && dom.dropdown.innerHTML) dom.dropdown.hidden = false;
    });
    dom.modalClose.addEventListener('click', closeCityModal);
    dom.modalBackdrop.addEventListener('click', closeCityModal);
    document.addEventListener('click', function (e) {
      if (dom.dropdown && !dom.dropdown.hidden && dom.inputCity && !dom.inputCity.contains(e.target) && !dom.dropdown.contains(e.target)) {
        hideDropdown();
      }
    });
    requestGeo();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
