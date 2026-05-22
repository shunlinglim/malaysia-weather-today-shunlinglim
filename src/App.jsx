import dayjs from "dayjs";
import { useEffect, useState, useCallback } from "react"; 
import './App.css';
import weatherStatus from './weatherStatus.json';
import { Button } from './components/Button'
import { Card } from './components/Card'
import districtsData from './district.json';

function App() {
    const [ isFading, setIsFading ] = useState(false);
    const [ isVisible, setIsVisible ] = useState(true);
    const [ currentTempData, setCurrentTempData ] = useState();
    const [ lastUpdated, setLastUpdated ] = useState(dayjs().format());
    const [ isCelsius, setIsCelsius ] = useState(JSON.parse(localStorage.getItem('isCelsius') || true));
    const [ currentDistrictInfo, setCurrentDistrictInfo ] = useState(() => {
        const saved = localStorage.getItem('currentDistrictInfo');
        return saved !== null ? JSON.parse(saved) : {
            "district": "Kuala Lumpur",
            "abbrev": ["KUL", "WPK", "KL"],
            "lat": 3.14,
            "lon": 101.69
        };
    });

    useEffect(() => {
        localStorage.setItem('isCelsius', JSON.stringify(isCelsius));
    }, [isCelsius]);

    useEffect(() => {
        localStorage.setItem('currentDistrictInfo', JSON.stringify(currentDistrictInfo));
    }, [currentDistrictInfo]);
    
    const stateAliases = {
        "Johor": ["JHR", "JOH"],
        "Kedah": ["KDH", "KED"],
        "Kelantan": ["KTN", "KEL"],
        "Melaka": ["MLK", "MEL"],
        "Negeri Sembilan": ["NSN", "NSB"],
        "Pahang": ["PHG", "PAH"],
        "Penang": ["PNG", "PEN"],
        "Perak": ["PRK", "PER"],
        "Perlis": ["PLS", "PER"],
        "Selangor": ["SGR", "SEL"],
        "Terengganu": ["TRG", "TER"],
        "Sabah": ["SBH", "SAB"],
        "Sarawak": ["SWK", "SAR"]
    };

    const allDistricts = districtsData.flatMap(stateObj => {
        const stateName = Object.keys(stateObj)[0]; // e.g., "Federal Territories"
        const aliases = stateAliases[stateName] || [];

        return stateObj[stateName].map(districtInfo => {
            const federalTerritoriesAliases = (districtInfo.abbrev || []).join(" ");
            const aliasString = aliases.join(" ");

            return {
                 state: stateName,
                ...districtInfo,
                searchBlob: `${stateName} ${districtInfo.district} ${aliasString} ${federalTerritoriesAliases}`.toLowerCase()
            }
        });
    });

    const updateNewDistrict = (info) => {
        setCurrentDistrictInfo(info); 
    }

    // Fetch Data
    useEffect(() => {
        const fetchData = async (retry = 0) => {
            try {
                const res = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${currentDistrictInfo.lat}&longitude=${currentDistrictInfo.lon}&hourly=temperature_2m,weather_code&daily=sunrise,sunset&past_hours=12&forecast_hours=13&timezone=Asia/Kuala_Lumpur`
                );

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();
                setCurrentTempData(data);

            } catch (err) {
                console.error("Fetch error:", err);

                // 🔁 retry up to 3 times
                if (retry < 3) {
                    setTimeout(() => {
                        fetchData(retry + 1);
                    }, 2000); // wait 2s
                }
            }
        };

        fetchData();
    }, [lastUpdated, currentDistrictInfo]);

    // Add loading layer only at the beginning
    useEffect(() => {
        let dataReady = false;
        let timeReady = false;

        const finishLoading = () => {
            if (dataReady && timeReady) {
                setIsFading(true);

                setTimeout(() => {
                    setIsVisible(false);
                }, 800);
            }
        };

        const timer = setTimeout(() => {
            timeReady = true;
            finishLoading();
        }, 2710);

        if (currentTempData) {
            dataReady = true;
            finishLoading();
        }

        return () => clearTimeout(timer);
    }, [currentTempData]);

    // Update the hourly time to trigger UI update
    useEffect(() => {
        let intervalId;

        const nextExecution = dayjs().add(1, 'hour').startOf('hour').add(10, 'second');
        const msUntilNextExecution = nextExecution.diff(dayjs());

        const timeoutId = setTimeout(() => {
            // Trigger the first update
            setLastUpdated(dayjs().format());

            // Then set an interval to update every hour exactly
            intervalId = setInterval(() => {
                setLastUpdated(dayjs().format());
            }, 3600000);

        }, msUntilNextExecution);

        return () => {
            clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    const getWeatherStatus = useCallback((code) => {
        if (!currentTempData || code === undefined) return null;

        const weatherCode = currentTempData?.hourly?.weather_code?.[code];
        let currentWeatherStatus;

        let nowHour;
        if (code < 12) {
            nowHour = dayjs().subtract(12 - code, 'hour').set('minute', 59);
        } else if (code === 12) {
            nowHour = dayjs().set('minute', 59);
        } else if (code > 12) {
            nowHour = dayjs().add(code - 12, 'hour').set('minute', 59);
        }

        const sunRiseTime = dayjs(currentTempData?.daily?.sunrise[0]);
        const sunSetTime = dayjs(currentTempData?.daily?.sunset[0]);

        if (nowHour.isAfter(sunRiseTime) && nowHour.isBefore(sunSetTime)) {
            currentWeatherStatus = 'Bright ';
        } else {
            currentWeatherStatus = 'Dark ';
        }

        if (weatherCode === 0) {
            currentWeatherStatus += 'None';
        } else if (weatherCode >= 1 && weatherCode <= 3) {
            currentWeatherStatus += 'Cloudy';
        } else if (weatherCode >= 51) {
            currentWeatherStatus += 'Raining';
        }

        return weatherStatus.find(item => item.id === currentWeatherStatus);
    }, [currentTempData]);

    const currentHourIndex = currentTempData?.hourly?.time.findIndex(t =>
        dayjs(t).format('YYYY-MM-DDTHH:00') === dayjs(lastUpdated).format('YYYY-MM-DDTHH:00')
    );
    const activeIndex = currentHourIndex !== -1 ? currentHourIndex : 12;

    // Update favicon
    useEffect(() => {
        const status = getWeatherStatus(activeIndex);
        if (status?.icon) {
            const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
            link.type = 'image/svg+xml';
            link.rel = 'icon';
            link.href = status.icon;
            document.getElementsByTagName('head')[0].appendChild(link);
        }
    }, [currentTempData, getWeatherStatus, activeIndex]);

    function changeTempUnit() {
        setIsCelsius(prev => !prev);
    }

    const currentStatusWallpaper = getWeatherStatus(activeIndex)?.wallpaper;
    const currentStatusOverlay = getWeatherStatus(activeIndex)?.bgOverlay;
    const currentStatusGradient = getWeatherStatus(activeIndex)?.gradient;

    return (
        <>
            {isVisible && (
                <div className={`loading-screen ${isFading ? 'loading-fade-out' : ''}`}>
                    <dotlottie-wc
                        src="https://lottie.host/51da771e-1227-436a-9fd4-d40776a60fd3/Du8eepDK0M.lottie"
                        autoplay
                        loop />
                </div>
            )}

            <div className="background-img" style={{ backgroundImage: `url(${currentStatusWallpaper})` }}>
                <div className="background-overlay" style={{ backgroundColor: currentStatusOverlay }}></div>

                <div className="content-wrapper">
                    <Button getWeatherStatus={getWeatherStatus}
                        isCelsius={isCelsius}
                        changeTempUnit={changeTempUnit}
                        activeIndex={activeIndex} />
                    <Card currentTempData={currentTempData}
                        getWeatherStatus={getWeatherStatus}
                        isCelsius={isCelsius}
                        changeTempUnit={changeTempUnit}
                        lastUpdated={lastUpdated}
                        activeIndex={activeIndex}
                        allDistricts={allDistricts}
                        currentDistrictInfo={currentDistrictInfo}
                        updateNewDistrict={updateNewDistrict} />
                    <p className="authorship" key={currentStatusGradient} style={{ backgroundImage: currentStatusGradient }}>Created by Lim Shun Ling</p>
                </div>
            </div>
        </>
    )
}

export default App;