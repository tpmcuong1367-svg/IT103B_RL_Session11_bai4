const MAX_LOAD_WATTS = 3000;
let idCounter = 0;

const SCENES = {
  GoodMorning: (device) => (device.type === "light" || device.type === "ac" ? true : null),
  LeaveHome: (device) => (device.alwaysOn ? null : false),
  SleepMode: (device) => (device.type === "light" || device.type === "tv" ? false : null),
};

const generateId = () => {
  idCounter++;
  let numberText = String(idCounter);
  while (numberText.length < 3) {
    numberText = "0" + numberText;
  }
  return "DEV_" + numberText;
};

const validateDevice = (dev) => {
  if (dev === null || typeof dev !== "object") return false;
  if (typeof dev.name !== "string" || dev.name.trim() === "") return false;
  if (typeof dev.room !== "string" || dev.room.trim() === "") return false;
  if (typeof dev.type !== "string" || dev.type.trim() === "") return false;
  if (typeof dev.powerWatts !== "number" || isNaN(dev.powerWatts) || dev.powerWatts <= 0) return false;
  return true;
};

const createDevice = (list, dev) => {
  if (!Array.isArray(list) || !validateDevice(dev)) return null;

  const device = {
    id: generateId(),
    name: dev.name.trim(),
    room: dev.room.trim(),
    type: dev.type.trim(),
    powerWatts: dev.powerWatts,
    isActive: typeof dev.isActive === "boolean" ? dev.isActive : false,
    alwaysOn: typeof dev.alwaysOn === "boolean" ? dev.alwaysOn : false,
    status: dev.status === "error" ? "error" : "online",
  };
  list.push(device);
  return device;
};

const calculateEnergy = (list) => {
  let total = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].isActive && list[i].status === "online") {
      total += list[i].powerWatts;
    }
  }
  return total;
};

const findHighestPowerIndex = (list) => {
  let highestIndex = -1;
  for (let i = 0; i < list.length; i++) {
    const device = list[i];
    if (!device.isActive || device.status !== "online" || device.alwaysOn) continue;
    if (highestIndex === -1 || device.powerWatts > list[highestIndex].powerWatts) {
      highestIndex = i;
    }
  }
  return highestIndex;
};

const handleOverload = (list, result) => {
  while (calculateEnergy(list) > MAX_LOAD_WATTS) {
    const index = findHighestPowerIndex(list);
    if (index === -1) break;
    list[index].isActive = false;
    result.cutoff.push(list[index].name);
  }
};

const triggerScene = (list, sceneName) => {
  const result = { success: false, scene: sceneName, changed: [], skipped: [], cutoff: [], message: "" };

  if (!Array.isArray(list)) {
    result.message = "Danh sách thiết bị không hợp lệ";
    return result;
  }
  if (typeof sceneName !== "string" || !Object.prototype.hasOwnProperty.call(SCENES, sceneName)) {
    result.message = "Ngữ cảnh không tồn tại: " + sceneName;
    return result;
  }

  const rule = SCENES[sceneName];
  for (let i = 0; i < list.length; i++) {
    const device = list[i];
    const targetState = rule(device);
    if (targetState === null) continue;

    if (device.status === "error") {
      result.skipped.push(device.name);
      continue;
    }
    if (device.isActive !== targetState) {
      device.isActive = targetState;
      result.changed.push(device.name);
    }
  }

  handleOverload(list, result);

  result.success = true;
  result.message = "Đã kích hoạt ngữ cảnh " + sceneName;
  return result;
};

const printEnergyReport = (list) => {
  console.log("----- BÁO CÁO NĂNG LƯỢNG -----");
  for (let i = 0; i < list.length; i++) {
    const device = list[i];
    let state = device.isActive ? "BẬT" : "TẮT";
    if (device.status === "error") state = "LỖI KẾT NỐI";
    console.log(device.id + " | " + device.name + " | " + device.room + " | " + device.powerWatts + "W | " + state);
  }
  const total = calculateEnergy(list);
  console.log("Tổng công suất đang bật: " + total + "W / " + MAX_LOAD_WATTS + "W");
  console.log("------------------------------");
};

const devices = [];

console.log("=== 1. CREATE ===");
createDevice(devices, { name: "Điều hòa", room: "Phòng khách", type: "ac", powerWatts: 1500 });
createDevice(devices, { name: "Bình nóng lạnh", room: "Phòng tắm", type: "heater", powerWatts: 2000, isActive: true });
createDevice(devices, { name: "Đèn phòng khách", room: "Phòng khách", type: "light", powerWatts: 10 });
createDevice(devices, { name: "Tivi", room: "Phòng khách", type: "tv", powerWatts: 120, isActive: true });
createDevice(devices, { name: "Tủ lạnh", room: "Bếp", type: "fridge", powerWatts: 150, isActive: true, alwaysOn: true });
createDevice(devices, { name: "Camera", room: "Cổng", type: "camera", powerWatts: 15, isActive: true, alwaysOn: true });
createDevice(devices, { name: "Máy giặt", room: "Ban công", type: "washer", powerWatts: 500, isActive: true, status: "error" });
console.log("Thiếu tên:", createDevice(devices, { name: "", room: "Bếp", type: "fan", powerWatts: 50 }));
console.log("Công suất = 0:", createDevice(devices, { name: "Quạt", room: "Bếp", type: "fan", powerWatts: 0 }));
console.log("Số thiết bị:", devices.length);

printEnergyReport(devices);

console.log("\n=== 2. GoodMorning (bật điều hòa gây quá tải) ===");
console.log(triggerScene(devices, "GoodMorning"));
printEnergyReport(devices);

console.log("\n=== 3. SleepMode ===");
console.log(triggerScene(devices, "SleepMode"));
printEnergyReport(devices);

console.log("\n=== 4. LeaveHome (có thiết bị lỗi kết nối) ===");
console.log(triggerScene(devices, "LeaveHome"));
printEnergyReport(devices);

console.log("\n=== 5. Ngữ cảnh không tồn tại ===");
console.log(triggerScene(devices, "PartyMode"));
console.log(triggerScene(devices, "toString"));