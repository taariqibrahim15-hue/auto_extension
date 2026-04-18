// seatMonitor.js - COMPLETE WORKING VERSION
(function() {
    'use strict';
    
    // Prevent duplicate execution
    if (window.__seatMonitorController?.isRunning) return;
    
    // ================= CONTROLLER =================
    if (!window.__seatMonitorController) {
        window.__seatMonitorController = {
            isRunning: false,
            start: null,
            stop: null
        };
    }
    
    let currentBookingInterval = null;
    let observer = null;
    
    // ================= CONFIG =================
    const CONFIG = {
        apiCheckInterval: 1000,      // Check API every 1 second
        bookingDelay: 300,            // Delay between booking steps
        maxPopupWait: 10000,          // Wait 10 seconds for popup
        maxProceedWait: 30000         // Wait 30 seconds for proceed button
    };
    
    // ================= STATE =================
    let isProcessing = false;
    let isBooking = false;
    let waitingForProceed = false;
    let confirmClicked = false;
    let totalHits = 0;
    let successfulHits = 0;
    let failedHits = 0;
    let generalSeatFoundCount = 0;
    let startTime = Date.now();
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const routeIds = urlParams.get('routeIds');
    const seatClass = urlParams.get('seatClass');
    const deckNo = urlParams.get('deckNo');
    
    // API URL
    const API_URL = `https://lakshadweep.irctc.co.in/api/v1/voyage-route/seats/layout?routeIds=${routeIds}&seatClass=${seatClass}&deckNo=${deckNo}`;
    
    // ================= UI =================
    function createStats() {
        if (document.getElementById("seat-monitor-stats")) return;
        
        const div = document.createElement("div");
        div.id = "seat-monitor-stats";
        div.style.cssText = `
            position:fixed;
            top:10px;
            right:10px;
            background:rgba(0,0,0,0.85);
            color:#00ff00;
            padding:12px 20px;
            z-index:99999;
            font-size:12px;
            border-radius:8px;
            border:1px solid #00ff00;
            font-family:monospace;
            min-width:250px;
        `;
        
        div.innerHTML = `
            <div style="font-weight:bold;margin-bottom:8px;">🎯 SEAT MONITOR</div>
            <div>Hits: <span id="hits">0</span> | Success: <span id="success">0</span></div>
            <div>Fail: <span id="fail">0</span> | GENERAL: <span id="general">0</span></div>
            <div>Rate: <span id="rate">0</span>% | Runtime: <span id="runtime">0</span>s</div>
        `;
        
        document.body.appendChild(div);
        
        setInterval(() => {
            const runtime = Math.floor((Date.now() - startTime) / 1000);
            const rate = totalHits > 0 ? ((successfulHits / totalHits) * 100).toFixed(1) : 0;
            
            document.getElementById("hits").textContent = totalHits;
            document.getElementById("success").textContent = successfulHits;
            document.getElementById("fail").textContent = failedHits;
            document.getElementById("general").textContent = generalSeatFoundCount;
            document.getElementById("rate").textContent = rate;
            document.getElementById("runtime").textContent = runtime;
        }, 1000);
    }
    
    // ================= HELPERS =================
    function log(msg, type = "INFO") {
        const ts = new Date().toLocaleTimeString();
        console.log(`[${ts}] ${msg}`);
    }
    
    function clickElement(el) {
        if (!el) return false;
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
    }
    
    // ================= DOM SEAT CHECK =================
    function getClickableSeatsFromDOM() {
        const seats = document.querySelectorAll("g");
        const available = [];
        
        seats.forEach(seat => {
            const style = seat.getAttribute('style') || '';
            if (!style.includes('cursor: pointer')) return;
            if (seat.querySelector('image')) return;
            
            const rect = seat.querySelector("rect");
            const text = seat.querySelector("text");
            
            if (rect && rect.getAttribute("fill") === "#fff" && text) {
                available.push({
                    el: seat,
                    seatNo: text.textContent.trim()
                });
            }
        });
        
        return available;
    }
    
    // ================= API CHECK =================
    async function checkAPIForGeneralSeats() {
        if (isProcessing || isBooking || waitingForProceed) return null;
        
        totalHits++;
        
        try {
            const response = await fetch(API_URL, {
                headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
                credentials: 'include',
                cache: 'no-store'
            });
            
            if (!response.ok) {
                failedHits++;
                return null;
            }
            
            successfulHits++;
            const data = await response.json();
            
            if (data.status === 'success' && data.data?.deck?.seats) {
                const seats = data.data.deck.seats;
                const availableSeats = seats.filter(s => s.status === 'AVAILABLE');
                const generalSeats = availableSeats.filter(s => s.seatQuota === 'GENERAL');
                
                if (generalSeats.length > 0) {
                    generalSeatFoundCount += generalSeats.length;
                    log(`🎉 ${generalSeats.length} GENERAL seat(s) available!`, "SUCCESS");
                    return generalSeats;
                }
            }
            return null;
        } catch (error) {
            failedHits++;
            return null;
        }
    }
    
    // ================= CLICK SEAT =================
    function clickSeat(seatEl, seatNo) {
        if (isBooking) return false;
        
        log(`🖱️ Clicking seat: ${seatNo}`, "BOOKING");
        isBooking = true;
        
        clickElement(seatEl);
        
        setTimeout(handlePopup, CONFIG.bookingDelay);
        return true;
    }
    
    function tryClickFirstAvailableSeat() {
        const seats = getClickableSeatsFromDOM();
        if (seats.length === 0) return false;
        
        const seat = seats[0];
        return clickSeat(seat.el, seat.seatNo);
    }
    
    // ================= POPUP HANDLING =================
    function handlePopup() {
        log("Checking for booking popup...", "BOOKING");
        
        let checks = 0;
        const maxChecks = CONFIG.maxPopupWait / 500;
        
        const checkInterval = setInterval(() => {
            const popupDiv = document.querySelector('div[style*="position: absolute"]');
            
            if (popupDiv) {
                log("✅ Popup detected", "SUCCESS");
                
                const checkbox = popupDiv.querySelector('input[type="checkbox"]');
                if (checkbox && !checkbox.checked) {
                    clickElement(checkbox);
                    log("Checkbox checked", "BOOKING");
                }
                
                const confirmBtn = Array.from(document.querySelectorAll('button')).find(
                    btn => btn.textContent && btn.textContent.trim() === "Confirm Seats"
                );
                
                if (confirmBtn && !confirmClicked) {
                    confirmClicked = true;
                    log("✅ Clicking Confirm Seats", "SUCCESS");
                    clickElement(confirmBtn);
                    clearInterval(checkInterval);
                    
                    waitingForProceed = true;
                    isBooking = false;
                    isProcessing = false;
                    
                    monitorForProceedButton();
                }
            }
            
            checks++;
            if (checks >= maxChecks) {
                log("Popup timeout", "ERROR");
                clearInterval(checkInterval);
                isBooking = false;
                isProcessing = false;
            }
        }, 500);
    }
    
    function monitorForProceedButton() {
        log("Waiting for Proceed button after refresh...", "BOOKING");
        
        const proceedInterval = setInterval(() => {
            const proceedBtn = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent && btn.textContent.trim() === "Proceed" && !btn.disabled
            );
            
            if (proceedBtn && waitingForProceed) {
                log("🎉 Proceed button found! Clicking...", "SUCCESS");
                clickElement(proceedBtn);
                log("%c✅✅✅ BOOKING COMPLETE! ✅✅✅", "color: #00ff00; font-size: 14px");
                
                waitingForProceed = false;
                clearInterval(proceedInterval);
                
                if (currentBookingInterval) {
                    clearInterval(currentBookingInterval);
                }
            }
        }, 500);
    }
    
    // ================= MAIN MONITOR =================
    async function monitor() {
        if (isProcessing || isBooking || waitingForProceed) return;
        
        isProcessing = true;
        
        // First try DOM seats
        if (tryClickFirstAvailableSeat()) {
            isProcessing = false;
            return;
        }
        
        // Then check API for GENERAL seats
        const apiSeats = await checkAPIForGeneralSeats();
        if (apiSeats && apiSeats.length > 0) {
            // Wait a moment for DOM to update, then try again
            setTimeout(() => {
                if (tryClickFirstAvailableSeat()) {
                    log("Booked from API-detected seat!", "SUCCESS");
                }
                isProcessing = false;
            }, 500);
            return;
        }
        
        isProcessing = false;
    }
    
    // ================= START/STOP =================
    function start() {
        if (window.__seatMonitorController.isRunning) return;
        
        window.__seatMonitorController.isRunning = true;
        log("🚀 Seat Monitor STARTED", "SUCCESS");
        
        createStats();
        
        // Check if we're waiting for Proceed after a refresh
        const proceedBtn = Array.from(document.querySelectorAll('button')).find(
            btn => btn.textContent && btn.textContent.trim() === "Proceed" && !btn.disabled
        );
        if (proceedBtn) {
            log("Proceed button found on page load!", "SUCCESS");
            clickElement(proceedBtn);
            return;
        }
        
        currentBookingInterval = setInterval(monitor, CONFIG.apiCheckInterval);
        
        // DOM observer for new seats
        observer = new MutationObserver(() => {
            if (!isProcessing && !isBooking && !waitingForProceed) {
                monitor();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
    
    function stop() {
        window.__seatMonitorController.isRunning = false;
        if (currentBookingInterval) clearInterval(currentBookingInterval);
        if (observer) observer.disconnect();
        
        const stats = document.getElementById("seat-monitor-stats");
        if (stats) stats.remove();
        
        log("🔴 Seat Monitor STOPPED", "WARNING");
    }
    
    // Assign controller methods
    window.__seatMonitorController.start = start;
    window.__seatMonitorController.stop = stop;
    
    // ================= MESSAGE HANDLER =================
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "SEAT_MONITOR_TOGGLE") {
            msg.enabled ? start() : stop();
        }
    });
    
    // ================= AUTO START =================
    chrome.storage.local.get("seatMonitorEnabled", (res) => {
        if (res.seatMonitorEnabled === true) {
            setTimeout(start, 1500);
        }
    });
})();