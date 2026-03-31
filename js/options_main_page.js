var arguments = getUrlVars();
var element = "support";

if (arguments.page !== undefined) {
    element = arguments.page;
    location.href = "/options_pages/" + element + ".html";
} else {
    chrome.storage.local.get("option_panel", function (items) {
        var panel = items.option_panel;
        if (panel !== "null" && panel !== null && panel !== undefined) {
            element = panel;
        }
        location.href = "/options_pages/" + element + ".html";
    });
}