/* ======================================================
 * CAU 8: DANG NHAP + ADMIN QUAN LY DON HANG
 * ====================================================== */
var orders = [];        // tat ca don hang (carts.xml + localStorage)
var customerNames = {}; // customerId -> ten
var employeeNames = {}; // employeeId -> ten
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

    // loc don hang
    document.getElementById("txtFind").addEventListener("input", render_orders);
    document.getElementById("cbStatus").addEventListener("change", render_orders);
    // 1 listener cho bang don hang (event delegation)
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

/** Bang don hang, co loc theo trang thai va tu khoa */
function render_orders()
{
    var status = document.getElementById("cbStatus").value;
    var key = document.getElementById("txtFind").value.trim().toLowerCase();
    var tbody = document.getElementById("tbOrders");
    tbody.innerHTML = "";
    var sorted = orders.slice().sort(function(a, b) { return a.orderDate < b.orderDate ? 1 : -1; });
    for(var i = 0; i < sorted.length; i++)
    {
        var o = sorted[i];
        if(status != "" && o.status != status) continue;
        if(key != "" && (o.id + " " + o.customerName).toLowerCase().indexOf(key) == -1) continue;

        var tr = document.createElement("tr");
        tr.innerHTML =
            "<td><strong>" + o.id + "</strong></td>" +
            "<td>" + o.orderDate.replace("T", " ").substring(0, 16) + "</td>" +
            "<td></td>" +
            "<td>" + (employeeNames[o.employeeId] || o.employeeId) + "</td>" +
            "<td>" + o.paymentMethod + "</td>" +
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
        tr.cells[6].appendChild(select);
        tbody.appendChild(tr);
    }
    if(tbody.children.length == 0)
        tbody.innerHTML = "<tr><td colspan='8' class='empty'>Không có đơn hàng phù hợp</td></tr>";
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

/** Thong ke san pham duoc ban (khong tinh don da huy), sap xep giam dan theo so luong */
function render_top_products()
{
    var map = {};
    for(var i = 0; i < orders.length; i++)
    {
        var o = orders[i];
        if(o.status == "cancelled") continue;
        for(var j = 0; j < o.details.length; j++)
        {
            var d = o.details[j];
            if(map[d.productId] == undefined)
                map[d.productId] = { id: d.productId, name: d.productName, qty: 0, revenue: 0 };
            map[d.productId].qty += d.quantity;
            map[d.productId].revenue += d.amount;
        }
    }
    var list = [];
    for(var k in map) list.push(map[k]);
    list.sort(function(a, b) { return b.qty - a.qty || b.revenue - a.revenue; });

    var tbody = document.getElementById("tbTop");
    tbody.innerHTML = "";
    for(var i = 0; i < list.length; i++)
    {
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + (i + 1) + "</td><td>" + list[i].id + "</td><td></td><td>" + list[i].qty + "</td><td class='num'>" + money(list[i].revenue) + "</td>";
        tr.cells[2].textContent = list[i].name;
        tbody.appendChild(tr);
    }
}
