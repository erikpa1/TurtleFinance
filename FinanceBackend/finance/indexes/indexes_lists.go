package indexes

// Embedded constituent snapshots (Yahoo Finance symbols). Index membership
// changes over time – edit these lists or use the live S&P 500 source.
// Snapshot date: 2025. Sector is filled in by the fundamentals sync.

var dow30 = []string{
	"AAPL", "AMGN", "AMZN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS",
	"GS", "HD", "HON", "IBM", "JNJ", "JPM", "KO", "MCD", "MMM", "MRK",
	"MSFT", "NKE", "NVDA", "PG", "SHW", "TRV", "UNH", "V", "VZ", "WMT",
}

var nasdaq100 = []string{
	"AAPL", "ABNB", "ADBE", "ADI", "ADP", "ADSK", "AEP", "AMAT", "AMD", "AMGN",
	"AMZN", "ANSS", "APP", "ARM", "ASML", "AVGO", "AXON", "AZN", "BIIB", "BKNG",
	"BKR", "CCEP", "CDNS", "CDW", "CEG", "CHTR", "CMCSA", "COST", "CPRT", "CRWD",
	"CSCO", "CSGP", "CSX", "CTAS", "CTSH", "DASH", "DDOG", "DXCM", "EA", "EXC",
	"FANG", "FAST", "FTNT", "GEHC", "GFS", "GILD", "GOOG", "GOOGL", "HON", "IDXX",
	"INTC", "INTU", "ISRG", "KDP", "KHC", "KLAC", "LIN", "LRCX", "LULU", "MAR",
	"MCHP", "MDLZ", "MELI", "META", "MNST", "MRVL", "MSFT", "MSTR", "MU", "NFLX",
	"NVDA", "NXPI", "ODFL", "ON", "ORLY", "PANW", "PAYX", "PCAR", "PDD", "PEP",
	"PLTR", "PYPL", "QCOM", "REGN", "ROP", "ROST", "SBUX", "SNPS", "TEAM", "TMUS",
	"TSLA", "TTD", "TTWO", "TXN", "VRSK", "VRTX", "WBD", "WDAY", "XEL", "ZS",
}

var dax40 = []string{
	"ADS.DE", "AIR.DE", "ALV.DE", "BAS.DE", "BAYN.DE", "BEI.DE", "BMW.DE", "BNR.DE", "CBK.DE", "CON.DE",
	"DB1.DE", "DBK.DE", "DHL.DE", "DTE.DE", "DTG.DE", "ENR.DE", "EOAN.DE", "FRE.DE", "G1A.DE", "HEI.DE",
	"HEN3.DE", "HNR1.DE", "IFX.DE", "MBG.DE", "MRK.DE", "MTX.DE", "MUV2.DE", "P911.DE", "PAH3.DE", "QIA.DE",
	"RHM.DE", "RWE.DE", "SAP.DE", "SHL.DE", "SIE.DE", "SRT3.DE", "SY1.DE", "VNA.DE", "VOW3.DE", "ZAL.DE",
}

var euroStoxx50 = []string{
	"ADS.DE", "ADYEN.AS", "AD.AS", "AI.PA", "AIR.PA", "ALV.DE", "ABI.BR", "ASML.AS", "CS.PA", "BAS.DE",
	"BAYN.DE", "BBVA.MC", "SAN.MC", "BMW.DE", "BNP.PA", "BN.PA", "DB1.DE", "DHL.DE", "DTE.DE", "ENEL.MI",
	"ENI.MI", "EL.PA", "RACE.MI", "IBE.MC", "ITX.MC", "IFX.DE", "INGA.AS", "ISP.MI", "KER.PA", "OR.PA",
	"MC.PA", "MBG.DE", "MUV2.DE", "NOKIA.HE", "NDA-FI.HE", "PRX.AS", "RMS.PA", "SAF.PA", "SAN.PA", "SAP.DE",
	"SU.PA", "SIE.DE", "STLAM.MI", "TTE.PA", "UCG.MI", "DG.PA", "VOW3.DE", "WKL.AS", "HO.PA", "RHM.DE",
}

// Curated thematic starter lists (not official indexes).
var themeFood = []string{
	"NESN.SW", "ULVR.L", "DANO.PA", "GIS", "K", "CPB", "CAG", "HRL", "TSN", "SJM",
	"MKC", "KHC", "MDLZ", "PEP", "KO", "ADM", "BG", "CTVA", "NTR", "DE",
	"MOS", "CF", "SYY", "KR", "WMT", "COST", "AD.AS", "CA.PA", "TSCO.L", "HSY",
}

var themeVice = []string{
	"PM", "MO", "BTI", "IMB.L", "JAPAY", "DEO", "STZ", "BUD", "TAP", "BF-B",
	"RI.PA", "HEIA.AS", "CARL-B.CO", "SAM", "LVS", "WYNN", "MGM", "CZR", "DKNG", "FLUT",
	"EVO.ST", "ENT.L", "TLRY", "CGC",
}

var themeInfrastructure = []string{
	"NEE", "DUK", "SO", "D", "AEP", "EXC", "XEL", "SRE", "AWK", "WTRG",
	"NG.L", "IBE.MC", "ENEL.MI", "EOAN.DE", "RWE.DE", "ENGI.PA", "VIE.PA", "KMI", "WMB", "OKE",
	"UNP", "CSX", "NSC", "CP", "AMT", "CCI", "EQIX", "DLR", "VZ", "T",
	"FER.MC", "DG.PA", "ADP.PA", "AENA.MC", "TRN.MI", "SRG.MI",
}

var themeDefense = []string{
	"LMT", "RTX", "NOC", "GD", "LHX", "HII", "BA", "RHM.DE", "BA.L", "SAAB-B.ST",
	"HO.PA", "LDO.MI", "AM.PA", "HAG.DE", "KOG.OL", "TXT", "BWXT", "KTOS", "AVAV", "PLTR",
}
