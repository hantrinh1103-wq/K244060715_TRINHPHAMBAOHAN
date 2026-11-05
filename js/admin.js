/* ======================================================
 * CAU 8: DANG NHAP + ADMIN QUAN LY DON HANG
 * ====================================================== */
var orders = [];        // tat ca don hang (carts.xml + localStorage)
var customerNames = {}; // customerId -> ten
var employeeNames = {}; // employeeId -> ten
var currentStatus = "";   // tab trang thai dang chon ("" = tat ca)
var shownOrders = [];     // danh sach don dang hien (de xuat CSV)
var statusText = { paid: "Đã thanh toán", pending: "Chờ xử lý", cancelled: "Đã hủy" };

function http_get(url, cb)
{
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.send();
    xhr.onreadystatechange = function()
    {
        if(this.readyState == 4)
        {
            if(this.status == 200)
                cb(xhr);
            else
                alert("Không tải được " + url + " (hãy chạy bằng Live Server).");
        }
    }
}

function money(n)
{
    return "$" + Number(n).toFixed(2);
}

/* ---------- Man hinh dang nhap ---------- */
function init_login(dataset, frm, pError)
{
    if(sessionStorage.getItem("adminUser") != null)
    {
        location.href = "admin.html";
        return;
    }
    document.getElementById(frm).addEventListener("submit", function(e)
    {
        e.preventDefault();
        var username = this.username.value.trim();
        var password = this.password.value;
        var error = document.getElementById(pError);
        if(username == "" || password == "")
        {
            error.textContent = "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu";
            return;
        }
        http_get(dataset, function(xhr)
        {
            var employees = JSON.parse(xhr.responseText);
            for(var i = 0; i < employees.length; i++)
            {
                var emp = employees[i];
                if(emp.username == username && emp.password == password)
                {
                    if(emp.role != "admin" || emp.status != "active")
                    {
                        error.textContent = "Tài khoản này không có quyền truy cập trang quản trị";
                        return;
                    }
                    sessionStorage.setItem("adminUser", JSON.stringify({ employeeId: emp.employeeId, fullName: emp.fullName, role: emp.role }));
                    location.href = "admin.html";
                    return;
                }
            }
            error.textContent = "Sai tên đăng nhập hoặc mật khẩu";
        });
    });
}

/** Chua dang nhap thi quay ve login.html */
function require_login()
{
    if(sessionStorage.getItem("adminUser") == null)
        location.replace("login.html");
}

/* ---------- Trang admin ---------- */
function init_admin(cartSet, customerSet, employeeSet)
{
    var user = JSON.parse(sessionStorage.getItem("adminUser"));
    if(user == null)
        return;
    document.getElementById("spUser").innerHTML = "👤 " + user.fullName;
    document.getElementById("btnLogout").addEventListener("click", function()
    {
        sessionStorage.removeItem("adminUser");
        location.href = "login.html";
    });

    http_get(customerSet, function(x1)
    {
        var list = JSON.parse(x1.responseText);
        for(var i = 0; i < list.length; i++)
            customerNames[list[i].customerId] = list[i].fullName;
        http_get(employeeSet, function(x2)
        {
            var list2 = JSON.parse(x2.responseText);
            for(var i = 0; i < list2.length; i++)
                employeeNames[list2[i].employeeId] = list2[i].fullName;
            employeeNames["WEB"] = "Đặt hàng online";
            http_get(cartSet, function(x3)
            {
                load_orders(x3.responseXML);
                render_all();
            });
        });
    });

    // dieu huong giua cac man hinh (Thong ke / Don hang / San pham ban chay)
    document.querySelector(".side nav").addEventListener("click", function(e)
    {
        var a = e.target.closest("a[data-view]");
        if(a == null)
            return;
        e.preventDefault();
        show_view(a.dataset.view);
    });
    show_view(location.hash.replace("#", "") || "stats");

    // bo loc don hang
    document.getElementById("txtFind").addEventListener("input", render_orders);
    document.getElementById("dateFrom").addEventListener("change", render_orders);
    document.getElementById("dateTo").addEventListener("change", render_orders);
    document.getElementById("cbSort").addEventListener("change", render_orders);
    document.getElementById("btnClearFilter").addEventListener("click", clear_order_filter);
    document.getElementById("btnExport").addEventListener("click", export_orders_csv);
    document.getElementById("ordTabs").addEventListener("click", function(e)
    {
        var tab = e.target.closest("button[data-status]");
        if(tab == null)
            return;
        currentStatus = tab.dataset.status;
        render_order_tabs();
        render_orders();
    });
    // bo loc san pham ban chay
    document.getElementById("cbTop").addEventListener("change", render_top_products);
    document.getElementById("cbSortProd").addEventListener("change", render_top_products);    // 1 listener cho bang don hang (event delegation)
    document.getElementById("tbOrders").addEventListener("click", on_orders_click);
    document.getElementById("tbOrders").addEventListener("change", on_orders_change);
}

function get_text(parent, tag)
{
    return parent.getElementsByTagName(tag)[0].childNodes[0].nodeValue;
}

/** Doc carts.xml bang DOM, gop them don dat tu website (localStorage), ap dung trang thai da sua */
function load_orders(xmlDoc)
{
    orders = [];
    var carts = xmlDoc.getElementsByTagName("cart");
    for(var i = 0; i < carts.length; i++)
    {
        var c = carts[i];
        var items = c.getElementsByTagName("item");
        var details = [];
        for(var j = 0; j < items.length; j++)
        {
            details.push({
                productId: items[j].getAttribute("productId"),
                productName: get_text(items[j], "productName"),
                variant: "",
                quantity: parseInt(get_text(items[j], "quantity")),
                unitPrice: parseFloat(get_text(items[j], "unitPrice")),
                amount: parseFloat(get_text(items[j], "amount"))
            });
        }
        var cid = get_text(c, "customerId");
        orders.push({
            id: c.getAttribute("id"),
            orderDate: get_text(c, "orderDate"),
            employeeId: get_text(c, "employeeId"),
            customerId: cid,
            customerName: customerNames[cid] || cid,
            phone: "", email: "", address: "",
            paymentMethod: get_text(c, "paymentMethod"),
            status: c.getAttribute("status"),
            details: details,
            totalAmount: parseFloat(get_text(c, "totalAmount"))
        });
    }
    var web = JSON.parse(localStorage.getItem("orders")) || [];
    for(var i = 0; i < web.length; i++)
        orders.push(web[i]);

    var override = JSON.parse(localStorage.getItem("orderStatus")) || {};
    for(var i = 0; i < orders.length; i++)
        if(override[orders[i].id] != undefined)
            orders[i].status = override[orders[i].id];
}

function render_all()
{
    render_stats();
    render_charts();
    render_order_stats();
    render_order_tabs();
    render_orders();
    render_top_products();
}

/** The thong ke tong quan */
function render_stats()
{
    var revenue = 0, paid = 0, pending = 0, cancelled = 0, sold = 0;
    for(var i = 0; i < orders.length; i++)
    {
        var o = orders[i];
        if(o.status == "paid") { paid++; revenue += o.totalAmount; }
        else if(o.status == "pending") pending++;
        else cancelled++;
        if(o.status != "cancelled")
            for(var j = 0; j < o.details.length; j++)
                sold += o.details[j].quantity;
    }
    var cards = [
        ["Tổng đơn hàng", orders.length, "blue"],
        ["Doanh thu (đã thanh toán)", money(revenue), "green"],
        ["Đã thanh toán", paid, "green"],
        ["Chờ xử lý", pending, "orange"],
        ["Đã hủy", cancelled, "red"],
        ["Sản phẩm đã bán", sold, "purple"]
    ];
    var div = document.getElementById("divStats");
    div.innerHTML = "";
    for(var i = 0; i < cards.length; i++)
    {
        var card = document.createElement("article");
        card.className = "stat " + cards[i][2];
        card.innerHTML = "<span>" + cards[i][0] + "</span><strong>" + cards[i][1] + "</strong>";
        div.appendChild(card);
    }
}

/** Bieu do cot don gian bang div + CSS */
function render_charts()
{
    var byDay = {}, byPay = {};
    for(var i = 0; i < orders.length; i++)
    {
        var o = orders[i];
        if(o.status == "cancelled")
            continue;
        var day = o.orderDate.substring(0, 10);
        byDay[day] = (byDay[day] || 0) + o.totalAmount;
        byPay[o.paymentMethod] = (byPay[o.paymentMethod] || 0) + o.totalAmount;
    }
    draw_bars("chartDays", byDay, true);
    draw_bars("chartPay", byPay, false);
}

function draw_bars(id, data, vertical)
{
    var el = document.getElementById(id);
    el.innerHTML = "";
    var keys = Object.keys(data).sort();
    if(vertical && keys.length > 14)
        keys = keys.slice(-14);       // chi ve 14 ngay gan nhat cho de nhin
    var max = 0;
    for(var i = 0; i < keys.length; i++)
        if(data[keys[i]] > max) max = data[keys[i]];
    for(var i = 0; i < keys.length; i++)
    {
        var pct = max == 0 ? 0 : Math.round(data[keys[i]] / max * 100);
        var item = document.createElement("div");
        item.className = "bar";
        var label = vertical ? keys[i].substring(5) : keys[i];
        item.innerHTML = vertical
            ? '<em>' + money(data[keys[i]]) + '</em><div class="fill" style="height:' + pct + '%"></div><span>' + label + '</span>'
            : '<span>' + label + '</span><div class="track"><div class="fill" style="width:' + pct + '%"></div></div><em>' + money(data[keys[i]]) + '</em>';
        el.appendChild(item);
    }
}

/* ---------- dieu huong man hinh ---------- */
function show_view(name)
{
    if(["stats", "orders", "products"].indexOf(name) == -1)
        name = "stats";
    var views = document.getElementsByClassName("view");
    for(var i = 0; i < views.length; i++)
        views[i].hidden = (views[i].id != "view-" + name);
    var links = document.querySelectorAll(".side a[data-view]");
    for(var i = 0; i < links.length; i++)
        links[i].classList.toggle("active", links[i].dataset.view == name);
    history.replaceState(null, "", "#" + name);
    window.scrollTo(0, 0);
}

/* ---------- man hinh DON HANG ---------- */
function stat_card(label, value, color)
{
    var card = document.createElement("article");
    card.className = "stat " + color;
    card.innerHTML = "<span>" + label + "</span><strong>" + value + "</strong>";
    return card;
}

/** The thong ke nhanh cua man hinh don hang */
function render_order_stats()
{
    var total = 0, paid = 0, pending = 0, count = 0;
    for(var i = 0; i < orders.length; i++)
    {
        var o = orders[i];
        if(o.status == "cancelled") continue;
        count++;
        total += o.totalAmount;
        if(o.status == "paid") paid += o.totalAmount;
        if(o.status == "pending") pending += o.totalAmount;
    }
    var div = document.getElementById("ordStats");
    div.innerHTML = "";
    div.appendChild(stat_card("Giá trị đơn hợp lệ", money(total), "purple"));
    div.appendChild(stat_card("Đã thu", money(paid), "green"));
    div.appendChild(stat_card("Chờ thu (đơn chờ xử lý)", money(pending), "orange"));
}

/** Cac tab trang thai co dem so don */
function render_order_tabs()
{
    var counts = { "": orders.length, paid: 0, pending: 0, cancelled: 0 };
    for(var i = 0; i < orders.length; i++)
        counts[orders[i].status]++;
    var tabs = [["", "Tất cả"], ["paid", "Đã thanh toán"], ["pending", "Chờ xử lý"], ["cancelled", "Đã hủy"]];
    var box = document.getElementById("ordTabs");
    box.innerHTML = "";
    for(var i = 0; i < tabs.length; i++)
    {
        var b = document.createElement("button");
        b.type = "button";
        b.dataset.status = tabs[i][0];
        b.className = "tab" + (currentStatus == tabs[i][0] ? " active" : "");
        b.innerHTML = tabs[i][1] + " <span>" + counts[tabs[i][0]] + "</span>";
        box.appendChild(b);
    }
}

function clear_order_filter()
{
    document.getElementById("txtFind").value = "";
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    document.getElementById("cbSort").value = "date_desc";
    currentStatus = "";
    render_order_tabs();
    render_orders();
}

/** Bang don hang: loc theo tab trang thai, tu khoa, khoang ngay; sap xep */
function render_orders()
{
    var key = document.getElementById("txtFind").value.trim().toLowerCase();
    var from = document.getElementById("dateFrom").value;
    var to = document.getElementById("dateTo").value;
    var sort = document.getElementById("cbSort").value;
    var tbody = document.getElementById("tbOrders");
    tbody.innerHTML = "";

    var list = [];
    for(var i = 0; i < orders.length; i++)
    {
        var o = orders[i];
        var day = o.orderDate.substring(0, 10);
        if(currentStatus != "" && o.status != currentStatus) continue;
        if(key != "" && (o.id + " " + o.customerName).toLowerCase().indexOf(key) == -1) continue;
        if(from != "" && day < from) continue;
        if(to != "" && day > to) continue;
        list.push(o);
    }
    list.sort(function(a, b)
    {
        if(sort == "date_asc") return a.orderDate < b.orderDate ? -1 : 1;
        if(sort == "total_desc") return b.totalAmount - a.totalAmount;
        if(sort == "total_asc") return a.totalAmount - b.totalAmount;
        return a.orderDate < b.orderDate ? 1 : -1;
    });
    shownOrders = list;
    document.getElementById("ordCount").innerHTML = "Hiển thị <strong>" + list.length + "</strong> / " + orders.length + " đơn hàng";

    for(var i = 0; i < list.length; i++)
    {
        var o = list[i];
        var qty = 0;
        for(var j = 0; j < o.details.length; j++)
            qty += o.details[j].quantity;
        var tr = document.createElement("tr");
        tr.innerHTML =
            "<td><strong>" + o.id + "</strong></td>" +
            "<td>" + o.orderDate.replace("T", " ").substring(0, 16) + "</td>" +
            "<td></td>" +
            "<td>" + (employeeNames[o.employeeId] || o.employeeId) + "</td>" +
            "<td>" + o.paymentMethod + "</td>" +
            "<td>" + qty + "</td>" +
            "<td class='num'>" + money(o.totalAmount) + "</td>" +
            "<td></td>" +
            "<td><button type='button' class='btn small' data-action='detail' data-id='" + o.id + "'>Chi tiết</button></td>";
        tr.cells[2].textContent = o.customerName;
        // o chon trang thai (doi trang thai don hang)
        var select = document.createElement("select");
        select.className = "st " + o.status;
        select.dataset.id = o.id;
        for(var s in statusText)
        {
            var option = document.createElement("option");
            option.value = s;
            option.innerHTML = statusText[s];
            if(s == o.status) option.selected = true;
            select.appendChild(option);
        }
        tr.cells[7].appendChild(select);
        tbody.appendChild(tr);
    }
    if(list.length == 0)
        tbody.innerHTML = "<tr><td colspan='9' class='empty'>Không có đơn hàng phù hợp</td></tr>";
}

/** Xuat cac don dang hien ra file CSV (mo duoc bang Excel) */
function export_orders_csv()
{
    var lines = ["Mã đơn,Ngày tạo,Khách hàng,Nhân viên,Thanh toán,Trạng thái,Tổng tiền"];
    for(var i = 0; i < shownOrders.length; i++)
    {
        var o = shownOrders[i];
        lines.push([o.id, o.orderDate.replace("T", " "), '"' + o.customerName + '"', '"' + (employeeNames[o.employeeId] || o.employeeId) + '"',
                    '"' + o.paymentMethod + '"', statusText[o.status], o.totalAmount].join(","));
    }
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "don-hang.csv";
    a.click();
    URL.revokeObjectURL(a.href);
}
function on_orders_click(e)
{
    var btn = e.target.closest("button[data-action='detail']");
    if(btn == null)
        return;
    show_order_detail(btn.dataset.id);
}

/** Doi trang thai don hang, luu vao localStorage */
function on_orders_change(e)
{
    var select = e.target.closest("select[data-id]");
    if(select == null)
        return;
    var override = JSON.parse(localStorage.getItem("orderStatus")) || {};
    override[select.dataset.id] = select.value;
    localStorage.setItem("orderStatus", JSON.stringify(override));
    for(var i = 0; i < orders.length; i++)
        if(orders[i].id == select.dataset.id)
            orders[i].status = select.value;
    render_all();
}

function show_order_detail(id)
{
    var o = null;
    for(var i = 0; i < orders.length; i++)
        if(orders[i].id == id) o = orders[i];
    var html = "<h3>Đơn hàng " + o.id + "</h3><p class='meta'></p>" +
               "<table><thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>";
    for(var i = 0; i < o.details.length; i++)
    {
        var d = o.details[i];
        html += "<tr><td class='pn'></td><td>" + d.quantity + "</td><td class='num'>" + money(d.unitPrice) + "</td><td class='num'>" + money(d.amount) + "</td></tr>";
    }
    html += "</tbody></table><p class='total'>Tổng cộng: <strong>" + money(o.totalAmount) + "</strong></p>";
    var body = document.getElementById("dlgBody");
    body.innerHTML = html;
    var names = body.getElementsByClassName("pn");
    for(var i = 0; i < names.length; i++)
        names[i].textContent = o.details[i].productName + (o.details[i].variant ? " (" + o.details[i].variant + ")" : "");
    var meta = o.orderDate.replace("T", " ") + " · KH: " + o.customerName + " · NV: " + (employeeNames[o.employeeId] || o.employeeId) +
               " · " + o.paymentMethod + " · " + statusText[o.status];
    if(o.phone) meta += " · " + o.phone;
    if(o.address) meta += " · " + o.address;
    body.getElementsByClassName("meta")[0].textContent = meta;
    document.getElementById("dlgOrder").showModal();
}

/* ---------- man hinh SAN PHAM BAN CHAY ---------- */
/** Thong ke san pham duoc ban (khong tinh don da huy) */
function render_top_products()
{
    var map = {}, totalQty = 0, totalRevenue = 0;
    for(var i = 0; i < orders.length; i++)
    {
        var o = orders[i];
        if(o.status == "cancelled") continue;
        for(var j = 0; j < o.details.length; j++)
        {
            var d = o.details[j];
            if(map[d.productId] == undefined)
                map[d.productId] = { id: d.productId, name: d.productName, orders: 0, qty: 0, revenue: 0, seen: {} };
            var p = map[d.productId];
            if(!p.seen[o.id]) { p.seen[o.id] = true; p.orders++; }
            p.qty += d.quantity;
            p.revenue += d.amount;
            totalQty += d.quantity;
            totalRevenue += d.amount;
        }
    }
    var list = [];
    for(var k in map) list.push(map[k]);
    var sortBy = document.getElementById("cbSortProd").value;
    list.sort(function(a, b)
    {
        if(sortBy == "revenue") return b.revenue - a.revenue || b.qty - a.qty;
        return b.qty - a.qty || b.revenue - a.revenue;
    });

    // the tom tat
    var div = document.getElementById("prodStats");
    div.innerHTML = "";
    div.appendChild(stat_card("Số loại sản phẩm đã bán", list.length, "blue"));
    div.appendChild(stat_card("Tổng số lượng bán", totalQty, "purple"));
    div.appendChild(stat_card("Doanh thu từ sản phẩm", money(totalRevenue), "green"));
    if(list.length > 0)
    {
        var best = stat_card("Bán chạy nhất", "", "orange");
        best.getElementsByTagName("strong")[0].className = "best";
        best.getElementsByTagName("strong")[0].textContent = list[0].name;
        div.appendChild(best);
    }

    var top = parseInt(document.getElementById("cbTop").value);
    if(top > 0)
        list = list.slice(0, top);

    var medals = ["🥇", "🥈", "🥉"];
    var tbody = document.getElementById("tbTop");
    tbody.innerHTML = "";
    for(var i = 0; i < list.length; i++)
    {
        var share = totalRevenue == 0 ? 0 : list[i].revenue / totalRevenue * 100;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td class='rank'>" + (i < 3 ? medals[i] : i + 1) + "</td><td>" + list[i].id + "</td><td></td><td>" + list[i].orders +
                       "</td><td><strong>" + list[i].qty + "</strong></td><td class='num'>" + money(list[i].revenue) + "</td>" +
                       "<td><div class='share'><div class='track'><div class='fill' style='width:" + Math.round(share) + "%'></div></div><em>" + share.toFixed(1) + "%</em></div></td>";
        tr.cells[2].textContent = list[i].name;
        tbody.appendChild(tr);
    }
    if(list.length == 0)
        tbody.innerHTML = "<tr><td colspan='7' class='empty'>Chưa có dữ liệu bán hàng</td></tr>";
}