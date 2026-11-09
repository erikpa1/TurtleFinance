package categories

// DefaultCategories is the seed taxonomy. Users can edit/add categories;
// "Reset defaults" re-creates any of these that are missing.
var DefaultCategories = []Category{
	// Essentials – things people buy regardless of the economy
	{Key: "basic_food", Name: "Basic food", Group: GROUP_ESSENTIALS, Color: "#52c41a",
		Description: "Producers, processors and distributors of staple foods people need daily: grains, flour, bread, dairy, meat, eggs, fruit/vegetables, cooking oil, sugar, water, baby food, grocery retail focused on staples, fertilizer and seeds for food crops."},
	{Key: "food", Name: "Food & beverages (non-staple)", Group: GROUP_ESSENTIALS, Color: "#95de64",
		Description: "Packaged and processed foods, snacks, confectionery, soft drinks, restaurants and fast food, food service. Excludes alcohol (see alcohol)."},
	{Key: "agriculture", Name: "Agriculture", Group: GROUP_ESSENTIALS, Color: "#7cb305",
		Description: "Farming, agricultural machinery, crop inputs (fertilizers, pesticides, seeds), agricultural commodities trading, livestock."},
	{Key: "household_essentials", Name: "Household essentials", Group: GROUP_ESSENTIALS, Color: "#73d13d",
		Description: "Hygiene, cleaning products, toiletries, diapers, paper products and other everyday consumer staples that are not food."},
	{Key: "healthcare", Name: "Healthcare & pharma", Group: GROUP_ESSENTIALS, Color: "#13c2c2",
		Description: "Pharmaceuticals, generic drugs, vaccines, medical devices, hospitals, health insurance, diagnostics."},

	// Strategic / critical infrastructure
	{Key: "critical_infrastructure", Name: "Critical infrastructure", Group: GROUP_STRATEGIC, Color: "#1677ff",
		Description: "Operators or key suppliers of infrastructure society cannot function without: electricity grids and generation, water and wastewater, gas pipelines, telecom networks, railways, ports, airports, toll roads, payment rails, data centers, cloud backbone."},
	{Key: "utilities", Name: "Utilities", Group: GROUP_STRATEGIC, Color: "#2f54eb",
		Description: "Regulated electric, gas and water utilities and independent power producers."},
	{Key: "energy_fossil", Name: "Fossil energy", Group: GROUP_STRATEGIC, Color: "#614700",
		Description: "Oil and gas exploration, production, refining, oilfield services, coal mining, fossil fuel midstream."},
	{Key: "renewable_energy", Name: "Renewable energy", Group: GROUP_ESG, Color: "#389e0d",
		Description: "Solar, wind, hydro, geothermal, nuclear power, batteries and energy storage, EV charging, grid modernisation."},
	{Key: "defense", Name: "Defense & aerospace", Group: GROUP_STRATEGIC, Color: "#595959",
		Description: "Weapons, military equipment, defense contractors, military aerospace, cybersecurity for government/defense."},
	{Key: "semiconductors", Name: "Semiconductors", Group: GROUP_STRATEGIC, Color: "#722ed1",
		Description: "Chip design, foundries, semiconductor equipment, memory, critical electronic components."},
	{Key: "raw_materials", Name: "Raw materials & mining", Group: GROUP_STRATEGIC, Color: "#ad6800",
		Description: "Metals and mining (copper, lithium, iron ore, rare earths, gold), chemicals, steel, construction materials."},
	{Key: "housing_real_estate", Name: "Housing & real estate", Group: GROUP_OTHER, Color: "#d48806",
		Description: "REITs, homebuilders, real estate developers, building products."},
	{Key: "financials", Name: "Financials", Group: GROUP_OTHER, Color: "#08979c",
		Description: "Banks, insurance, asset managers, exchanges, payment processors, consumer finance."},
	{Key: "technology", Name: "Technology & software", Group: GROUP_OTHER, Color: "#9254de",
		Description: "Software, internet platforms, IT services, consumer electronics, social media, e-commerce platforms."},
	{Key: "luxury", Name: "Luxury & discretionary", Group: GROUP_OTHER, Color: "#eb2f96",
		Description: "Luxury goods, fashion, jewellery, premium cars, travel and leisure, cruise lines, hotels."},
	{Key: "transportation", Name: "Transportation & logistics", Group: GROUP_OTHER, Color: "#fa8c16",
		Description: "Airlines, trucking, shipping, parcel delivery, railroads operators, automotive manufacturers."},

	// Vice / addictive substances
	{Key: "addictive_substances", Name: "Addictive substances", Group: GROUP_VICE, Color: "#cf1322",
		Description: "Companies whose core revenue comes from addictive products: tobacco and nicotine (cigarettes, vapes, pouches), alcohol, cannabis, gambling. Use together with the more specific vice categories."},
	{Key: "tobacco", Name: "Tobacco & nicotine", Group: GROUP_VICE, Color: "#a8071a",
		Description: "Cigarettes, cigars, heated tobacco, e-cigarettes/vapes, nicotine pouches, tobacco leaf."},
	{Key: "alcohol", Name: "Alcohol", Group: GROUP_VICE, Color: "#ff4d4f",
		Description: "Beer, wine and spirits producers and distributors."},
	{Key: "gambling", Name: "Gambling", Group: GROUP_VICE, Color: "#f5222d",
		Description: "Casinos, sports betting, online gambling, lotteries, slot machine manufacturers."},
	{Key: "cannabis", Name: "Cannabis", Group: GROUP_VICE, Color: "#5b8c00",
		Description: "Medical or recreational cannabis growers, retailers and suppliers."},
	{Key: "sugar_heavy", Name: "Sugar-heavy / junk food", Group: GROUP_VICE, Color: "#ff7a45",
		Description: "Companies dominated by sugary drinks, candy, ultra-processed snacks and fast food."},

	// ESG flags
	{Key: "high_emissions", Name: "High emissions", Group: GROUP_ESG, Color: "#873800",
		Description: "Carbon-intensive business models: fossil fuels, cement, steel, airlines, heavy chemicals."},
	{Key: "dividend_aristocrat", Name: "Defensive dividend payer", Group: GROUP_OTHER, Color: "#1d39c4",
		Description: "Mature, defensive business with long history of stable or growing dividends and low cyclicality."},
}
