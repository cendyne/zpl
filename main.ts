function encode_utf16(s: string) {
  const a = new Uint8Array(s.length * 2 + 2),
    view = new DataView(a.buffer);
  view.setUint8(0, 254);
  view.setUint8(1, 255);
  s.split("").forEach(function (c, i) {
    view.setUint16(i * 2 + 2, c.charCodeAt(0), false);
  });
  return a;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { encodeHex } from "https://deno.land/x/tiny_encodings@0.2.1/index.ts";

let vertical_offset = 30;
let horizontal_offset = 100;
const print_width = Math.floor(203 * 1.0);

const badge_numbers =
  (prompt("Use Badge Numbers?") || "y").toLowerCase() == "y";

const use_peeler = (prompt("Use peeler?") || "y").toLowerCase() == "y";

const use_socket = (prompt("Use socket?") || "y").toLowerCase() == "y";

const wait_on_label = (prompt("Wait on label") || "n").toLowerCase() == "y";

const connection =
  (use_socket &&
    (await Deno.connect({
      //port: 6101,
      port: 9100,
      hostname: "192.168.1.196",
    }))) ||
  null;

if (connection) {
  connection.setKeepAlive(true);
  connection.setNoDelay(true);
}

for (let i = 1; i < 1000; i++) {
  const badge_name = (prompt("Name?") || "").trim();
  if (badge_name == "") {
    break;
  }
  const qr_content = prompt("QR?") || "";

  const output: string[] = [];
  // Reset things
  output.push("^PON^LH0,0^FWN\n");
  // Begin label
  output.push("^XA");
  // Set print mode
  if (use_peeler) {
    output.push("^MMP,Y");
  } else {
    output.push("^MMT,Y");
  }
  // Set orientation
  output.push("\n^PON\n");
  output.push(
    `^LS${horizontal_offset}^LT${vertical_offset}^PW${print_width}\n`,
  );
  let font_size = 50;
  if (badge_name.length > 12) {
    font_size = 40;
  }
  if (badge_name.length > 20) {
    font_size = 30;
  }
  if (i > 0 && badge_numbers) {
    const badge_number_horizontal_offset = horizontal_offset + 5;
    const badge_number_vertical_offset = 150;
    // important to have font sizes (28, 16) be multiples of 4 for font D
    // 15 here is a horizontal space
    output.push(
      `^FO${badge_number_horizontal_offset},${badge_number_vertical_offset}^ADN,28,16^FD\n${i}\n^FS\n`,
    );
  }

  output.push(
    `^FO${horizontal_offset + 5},0\n^A0N,${font_size},${font_size}^FB${print_width - 10},4,,C\n^FD\n`,
  );
  output.push(badge_name);
  output.push("\n\\&^FS\n");

  if (qr_content.length > 0) {
    let qr_horizontal_offset = print_width + horizontal_offset - 50;
    let qr_vertical_offset = 140;
    if (qr_content.length > 13) {
      qr_vertical_offset = 140 - 20;
      qr_horizontal_offset = print_width + horizontal_offset - 70;
    }
    output.push(
      `^FO${qr_horizontal_offset},${qr_vertical_offset}^BQN,2,2^FDLA,`,
    );
    output.push(qr_content);
    output.push("^FS\n");
  }

  output.push("^XZ");

  const commands = output.join("");
  console.log(commands);

  if (!connection) {
    const command = new Deno.Command("lp", {
      args: ["-d", "ZD620_Network", "-o", "raw"],
      stdin: "piped",
    });

    const process = command.spawn();
    const writer = process.stdin.getWriter();

    await writer.write(encode_utf16(commands));
    await writer.close();
    await process.status;
  } else {
    const command = encode_utf16(commands);
    await connection.write(command);
    if (wait_on_label) {
      await sleep(200);
      for (let i = 0; i < 100; i++) {
        await connection.write(encode_utf16("\n~HS\n"));
        await sleep(100);

        const response = new Uint8Array(300);
        const read_bytes = await connection.read(response);
        if (read_bytes) {
          const view = new DataView(response.buffer, 0, read_bytes);
          const host_status = new TextDecoder().decode(view).split("\n");
          console.log(host_status);
          const label_waiting = host_status[1].split(",")[7];
          console.log(`Label waiting?: ${label_waiting}`);
          if (label_waiting == "0") {
            break;
          }
        } else {
          console.log("Read bytes:", read_bytes);
        }

        await sleep(900);
      }
    }
  }

  console.log("Printed");
}
if (connection) {
  connection.close();
}
