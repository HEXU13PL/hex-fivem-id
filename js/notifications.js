const notificationContainer = document.getElementById('notification-container');
let notificationId = 0;

export const showNotification = (message, type = 'info', duration = 5000) => {
  const id = `notification-${notificationId++}`;
  
  let messageContent;
  let notificationType = type;
  let notificationDuration = duration;
  
  if (typeof message === 'object') {
    if (message.message) {
      messageContent = message.message;
      if (message.type) notificationType = message.type;
      if (message.duration) notificationDuration = message.duration;
    } else {
      messageContent = JSON.stringify(message);
    }
  } else {
    messageContent = String(message);
  }
  
  const notification = document.createElement('div');
  notification.className = `notification ${notificationType}`;
  notification.id = id;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'notification-content';
  contentDiv.textContent = messageContent;

  const closeButton = document.createElement('button');
  closeButton.className = 'close-notification';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '×';

  notification.appendChild(contentDiv);
  notification.appendChild(closeButton);

  notificationContainer.appendChild(notification);

  closeButton.addEventListener('click', () => {
    removeNotification(id);
  });

  if (notificationDuration > 0) {
    setTimeout(() => {
      removeNotification(id);
    }, notificationDuration);
  }

  return id;
};

export const removeNotification = (id) => {
  const notification = document.getElementById(id);
  if (notification) {
    notification.classList.add('fadeout');
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
      }
    }, 300);
  }
};

let notificationAudioContext;

const getNotificationAudioContext = () => {
  if (!notificationAudioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    notificationAudioContext = new AudioContext();
  }
  return notificationAudioContext;
};

const playStatusSound = () => {
  try {
    const audioContext = getNotificationAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    console.warn('Unable to play favorite status sound:', error);
  }
};

export const requestNotificationPermission = () => {
  const audioContext = getNotificationAudioContext();
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch((error) => {
      console.warn('Unable to resume favorite status sound:', error);
    });
  }
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch((error) => {
      console.warn('Unable to request notification permission:', error);
    });
  }
};

export const notifyFavoriteStatus = (playerName, isOnline) => {
  const message = isOnline
    ? `Ulubiony gracz "${playerName}" wszedł na serwer`
    : `Ulubiony gracz "${playerName}" wyszedł z serwera`;
  const type = isOnline ? 'success' : 'info';

  showNotification(message, type, 7000);
  playStatusSound();

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Status ulubionego gracza', {
      body: message,
      tag: `favorite-player-${playerName}`,
    });
  }
};

window.createNotification = showNotification;
window.removeNotification = removeNotification;
